import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Sizing = { media_kind: string | null; aspect_ratio: number | null; suggested_height: number | null };

function clampAR(ar: number | null | undefined): number | null {
  if (!ar || !isFinite(ar) || ar <= 0) return null;
  // Clamp to sane bounds (between ~9:21 and ~21:9)
  const clamped = Math.min(2.4, Math.max(0.42, ar));
  return Math.round(clamped * 10000) / 10000;
}

function suggestedHeightForText(text: string | null | undefined, base = 220): number {
  const len = (text || '').trim().length;
  // Approx 36 chars/line on mobile, ~22px per line. Avatar + actions ~base.
  const lines = Math.min(18, Math.max(1, Math.ceil(len / 36)));
  return Math.min(640, Math.max(200, base + lines * 22));
}

function classifyReddit(post: Record<string, unknown> | null, fallbackText: string): Sizing {
  if (!post) {
    return { media_kind: 'text', aspect_ratio: null, suggested_height: suggestedHeightForText(fallbackText, 280) };
  }
  const hint = typeof post.post_hint === 'string' ? post.post_hint.toLowerCase() : '';
  const isVideo = post.is_video === true || hint === 'hosted:video' || hint === 'rich:video';
  const isImage = hint === 'image' || hint === 'link' && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(post.url || ''));
  const isGallery = post.is_gallery === true || hint === 'gallery';
  const isSelf = post.is_self === true || hint === 'self';

  const srcW = readNum(post, ['preview', 'images', 0, 'source', 'width'])
    ?? readNum(post, ['media', 'reddit_video', 'width'])
    ?? null;
  const srcH = readNum(post, ['preview', 'images', 0, 'source', 'height'])
    ?? readNum(post, ['media', 'reddit_video', 'height'])
    ?? null;
  const ar = clampAR(srcW && srcH ? srcW / srcH : null);

  if (isVideo) return { media_kind: 'video', aspect_ratio: ar ?? 9 / 16, suggested_height: null };
  if (isGallery) return { media_kind: 'gallery', aspect_ratio: ar ?? 1, suggested_height: null };
  if (isImage) return { media_kind: 'image', aspect_ratio: ar ?? 4 / 5, suggested_height: null };
  if (isSelf) {
    const text = typeof post.selftext === 'string' ? post.selftext : fallbackText;
    return { media_kind: 'text', aspect_ratio: null, suggested_height: suggestedHeightForText(text, 280) };
  }
  // Link/article post → compact card
  return { media_kind: 'article', aspect_ratio: ar ?? 16 / 9, suggested_height: 360 };
}

function readNum(obj: unknown, path: Array<string | number>): number | null {
  let cur: unknown = obj;
  for (const k of path) {
    if (typeof k === 'number') {
      if (!Array.isArray(cur)) return null;
      cur = cur[k];
    } else {
      if (!cur || typeof cur !== 'object') return null;
      cur = (cur as Record<string, unknown>)[k];
    }
  }
  return typeof cur === 'number' && isFinite(cur) ? cur : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId, url, platform, previewOnly } = await req.json();
    const isPreviewOnly = !!previewOnly || !postId;

    console.log(`[fetch-post-preview] Processing postId=${postId ?? '(preview)'}, platform=${platform}, url=${url}`);

    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let thumbnailUrl: string | null = null;
    let previewText: string | null = null;
    let previewTitle: string | null = null;
    // Smart-sizing intel captured per branch so the card can render at the
    // right height from the first paint instead of guessing a fixed value.
    let sizing: Sizing = { media_kind: null, aspect_ratio: null, suggested_height: null };
    let oembedThumbW: number | null = null;
    let oembedThumbH: number | null = null;
    let redditPostData: Record<string, unknown> | null = null;

    // YouTube special handling - reliable thumbnails
    if (platform === 'youtube') {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
      sizing = { media_kind: 'video', aspect_ratio: 16 / 9, suggested_height: null };
    }
    // Instagram - use official oEmbed API with Meta token
    else if (platform === 'instagram') {
      const oembedData = await fetchInstagramOembed(url);
      if (oembedData?.thumbnail_url) {
        // Store thumbnail permanently
        thumbnailUrl = await storeThumbnailPermanently(postId, oembedData.thumbnail_url);
      }
      if (oembedData?.title) {
        previewText = oembedData.title;
      }
      oembedThumbW = oembedData?.thumbnail_width ?? null;
      oembedThumbH = oembedData?.thumbnail_height ?? null;
      const ar = oembedThumbW && oembedThumbH ? oembedThumbW / oembedThumbH : 1;
      sizing = { media_kind: 'image', aspect_ratio: clampAR(ar), suggested_height: null };
    }
    // Facebook - use official oEmbed API first, then the public plugin HTML.
    // Direct Facebook pages often return a login wall to server-side fetches;
    // the plugin endpoint still exposes public post captions/media.
    else if (platform === 'facebook') {
      let targetUrl = url;
      // Expand Facebook share URLs
      if (targetUrl.includes('facebook.com/share/') || targetUrl.includes('fb.watch') || targetUrl.includes('fb.me')) {
        try {
          const res = await fetch(targetUrl, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
          targetUrl = extractFacebookNextUrl(res.url) || res.url;
        } catch (e) { console.error('[fetch-post-preview] FB expansion failed', e); }
      }

      const useThumb = async (imageUrl: string | null | undefined) => {
        if (!imageUrl || isGenericPlaceholderImage(imageUrl)) return;
        thumbnailUrl = isPreviewOnly ? imageUrl : await storeThumbnailPermanently(postId, imageUrl);
      };

      const isJunk = (t: string | null) => !cleanFacebookCaption(t);

      const oembedData = await fetchFacebookOembed(targetUrl);
      if (oembedData?.thumbnail_url) {
        await useThumb(oembedData.thumbnail_url);
      }
      if (oembedData?.title) {
        const cleanedTitle = cleanFacebookCaption(oembedData.title);
        previewText = cleanedTitle;
        previewTitle = cleanedTitle;
      }
      oembedThumbW = oembedData?.thumbnail_width ?? null;
      oembedThumbH = oembedData?.thumbnail_height ?? null;

      // Fallback: scrape OG metadata
      if (!thumbnailUrl || !previewText) {
        const ogData = await scrapeOgData(targetUrl, 'facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)');
        if (!thumbnailUrl && ogData.image && !isGenericPlaceholderImage(ogData.image)) {
          await useThumb(ogData.image);
        }
        if (!previewText || isJunk(previewText)) {
          const candidate = cleanFacebookCaption(ogData.description) || cleanFacebookCaption(ogData.title);
          if (candidate) previewText = candidate;
        }
        if (!previewTitle || isJunk(previewTitle)) {
          const cleanTitle = cleanFacebookCaption(ogData.title);
          if (cleanTitle) previewTitle = cleanTitle;
        }
      }

      // Final fallback: public Facebook plugin page. This is the path that
      // recovers captions from data-testid="post_message" plus scontent images
      // when both Graph oEmbed and OG scraping are blocked by login walls.
      if (!thumbnailUrl || isJunk(previewText)) {
        const pluginData = await scrapeFacebookPlugin(targetUrl, url);
        if (!thumbnailUrl && pluginData.image) {
          await useThumb(pluginData.image);
        }
        if (isJunk(previewText) && pluginData.caption) {
          previewText = pluginData.caption;
        }
        if (isJunk(previewTitle) && pluginData.title) {
          previewTitle = pluginData.title;
        }
        if (oembedThumbW === null) oembedThumbW = pluginData.imageWidth;
        if (oembedThumbH === null) oembedThumbH = pluginData.imageHeight;
      }

      const isReel = /\/reel\//i.test(targetUrl);
      const isVideo =
        /\/videos?\//i.test(targetUrl) ||
        /\/watch(\/|\?)/i.test(targetUrl) ||
        /\/share\/v\//i.test(targetUrl) ||
        /(^|\/\/|\.)fb\.watch\//i.test(targetUrl);
      const ar = oembedThumbW && oembedThumbH ? oembedThumbW / oembedThumbH : (isReel ? 9 / 16 : (isVideo ? 16 / 9 : 4 / 5));
      sizing = { media_kind: isVideo || isReel ? 'video' : 'image', aspect_ratio: clampAR(ar), suggested_height: null };
    }
    // Reddit special handling
    else if (platform === 'reddit') {
      const redditData = await fetchRedditPreview(url);
      redditPostData = redditData.post_data ?? null;
      thumbnailUrl = redditData.thumbnail_url;
      previewTitle = redditData.title;
      previewText = redditData.description || redditData.title;
      sizing = classifyReddit(redditPostData, redditData.description || redditData.title || '');
    }
    // LinkedIn — OG description is short. The public embed page exposes the
    // full post commentary (with paragraph breaks) for any URN ID we can
    // extract from the share URL.
    else if (platform === 'linkedin') {
      const ogData = await scrapeOgData(url, 'facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)');
      thumbnailUrl = ogData.image && !isGenericPlaceholderImage(ogData.image) ? ogData.image : null;
      previewText = ogData.description || ogData.title || null;
      if (ogData.title) previewTitle = ogData.title;

      const liEmbed = await fetchLinkedInEmbedCaption(url);
      if (liEmbed.caption) {
        // Prefer the embed caption when it has paragraph breaks or is longer
        // than the OG description (which LinkedIn truncates near ~200 chars).
        const prev = (previewText || '').trim();
        if (!prev || liEmbed.caption.length > prev.length + 40 || liEmbed.caption.includes('\n')) {
          previewText = liEmbed.caption;
        }
      }
      if (!thumbnailUrl && liEmbed.image) {
        thumbnailUrl = isPreviewOnly ? liEmbed.image : await storeThumbnailPermanently(postId, liEmbed.image);
      }

      const hasVideo = ogData.hasVideo;
      const dims = ogData.imageWidth && ogData.imageHeight ? { w: ogData.imageWidth, h: ogData.imageHeight } : null;
      const ar = dims ? clampAR(dims.w / dims.h) : null;
      if (hasVideo) {
        sizing = { media_kind: 'video', aspect_ratio: ar ?? 16 / 9, suggested_height: null };
      } else if (thumbnailUrl) {
        sizing = { media_kind: 'image', aspect_ratio: ar ?? 4 / 5, suggested_height: null };
      } else {
        sizing = { media_kind: 'text', aspect_ratio: null, suggested_height: suggestedHeightForText(previewText) };
      }
    }
    // Article handling — try Medium RSS first (because Medium blocks the
    // normal HTML fetch for some posts), then fall back to the universal
    // metadata scraper that works on any website.
    else if (platform === 'article' || platform === 'medium') {
      const mediumData = await fetchMediumRssPreview(url);
      if (mediumData && mediumData.image) {
        previewTitle = mediumData.title;
        thumbnailUrl = mediumData.image;
        previewText = mediumData.description || mediumData.title;
      } else {
        const ogData = await scrapeOgData(url);
        previewTitle = (mediumData?.title) || ogData.title;
        thumbnailUrl = ogData.image && !isGenericPlaceholderImage(ogData.image) ? ogData.image : null;
        previewText = (mediumData?.description) || ogData.description || ogData.title;
        sizing.aspect_ratio = clampAR(ogData.imageWidth && ogData.imageHeight ? ogData.imageWidth / ogData.imageHeight : null);
      }
      sizing.media_kind = 'article';
      if (!sizing.aspect_ratio) sizing.aspect_ratio = 16 / 9;
    }
    // TikTok - use official oEmbed (no auth required) and store permanently
    else if (platform === 'tiktok') {
      const tiktokData = await fetchTikTokOembed(url);
      if (tiktokData?.thumbnail_url) {
        thumbnailUrl = await storeThumbnailPermanently(postId, tiktokData.thumbnail_url);
      }
      if (tiktokData?.title) {
        previewText = tiktokData.title;
      }
      const w = tiktokData?.thumbnail_width ?? null;
      const h = tiktokData?.thumbnail_height ?? null;
      const ar = w && h ? w / h : 9 / 16;
      sizing = { media_kind: 'video', aspect_ratio: clampAR(ar), suggested_height: null };
      // Fallback to OG scrape if oEmbed didn't yield a thumbnail
      if (!thumbnailUrl) {
        const ogData = await scrapeOgData(url);
        if (ogData.image) {
          thumbnailUrl = await storeThumbnailPermanently(postId, ogData.image);
        }
        if (!previewText) previewText = ogData.description || ogData.title;
      }
    }
    // Generic scraping for other platforms / unclassified URLs
    else {
      // Threads serves OG metadata only to crawler UAs; use facebookexternalhit.
      const isThreads = platform === 'threads' || /(?:^|\.)threads\.(?:net|com)\//i.test(url);
      const ogData = isThreads
        ? await scrapeOgData(url, 'facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)')
        : await scrapeOgData(url);
      thumbnailUrl = ogData.image && !isGenericPlaceholderImage(ogData.image) ? ogData.image : null;
      previewText = ogData.description || ogData.title;
      if (ogData.title) previewTitle = ogData.title;

      // For Threads: og:image is almost always the author's profile picture
      // (cdninstagram.com/.../profile_pic). That isn't a real post preview —
      // strip it so the typographic text card renders the post copy instead,
      // matching the X/Reddit behavior for text-only posts.
      if (isThreads && thumbnailUrl && isThreadsProfilePicture(thumbnailUrl)) {
        thumbnailUrl = null;
      }

      // Classify the generic / Threads / X / etc. branch
      const hasVideo = ogData.hasVideo;
      const dims = (ogData.videoWidth && ogData.videoHeight)
        ? { w: ogData.videoWidth, h: ogData.videoHeight }
        : (ogData.imageWidth && ogData.imageHeight)
          ? { w: ogData.imageWidth, h: ogData.imageHeight }
          : null;
      const ar = dims ? clampAR(dims.w / dims.h) : null;

      if (isThreads && !thumbnailUrl) {
        sizing = { media_kind: 'text', aspect_ratio: null, suggested_height: suggestedHeightForText(previewText) };
      } else if (hasVideo) {
        sizing = { media_kind: 'video', aspect_ratio: ar ?? 16 / 9, suggested_height: null };
      } else if (thumbnailUrl) {
        sizing = { media_kind: 'image', aspect_ratio: ar ?? 4 / 5, suggested_height: null };
      } else {
        sizing = { media_kind: 'text', aspect_ratio: null, suggested_height: suggestedHeightForText(previewText) };
      }
    }

    // Update database (skipped in preview-only mode used before the post exists)
    if (!isPreviewOnly) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const updatePayload: Record<string, string | number | null> = {
        thumbnail_url: thumbnailUrl,
        preview_image_url: thumbnailUrl,
        preview_text: previewText,
        media_kind: sizing.media_kind,
        aspect_ratio: sizing.aspect_ratio,
        suggested_height: sizing.suggested_height,
      };
      if (previewTitle) {
        updatePayload.title = previewTitle;
        updatePayload.preview_title = previewTitle;
      }
      const { error: updateError } = await supabase
        .from('posts')
        .update(updatePayload)
        .eq('id', postId);

      if (updateError) {
        console.error('[fetch-post-preview] DB update error:', updateError);
      } else {
        console.log(`[fetch-post-preview] Updated post ${postId} with thumbnail: ${thumbnailUrl}`);
      }
    }

    return new Response(
      JSON.stringify({
        thumbnail_url: thumbnailUrl,
        preview_image_url: thumbnailUrl,
        title: previewTitle,
        preview_text: previewText,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fetch-post-preview] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]{11}).*/
  );
  return match?.[1] ?? null;
}

// Fetch Instagram thumbnail using official oEmbed API
async function fetchInstagramOembed(url: string): Promise<{ thumbnail_url: string | null; title: string | null; thumbnail_width: number | null; thumbnail_height: number | null } | null> {
  const metaToken = Deno.env.get('META_APP_TOKEN');
  
  if (!metaToken) {
    console.log('[fetch-post-preview] No META_APP_TOKEN, cannot fetch Instagram oEmbed');
    return null;
  }

  try {
    const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${metaToken}`;
    
    console.log('[fetch-post-preview] Fetching Instagram oEmbed...');
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[fetch-post-preview] Instagram oEmbed failed: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log('[fetch-post-preview] Instagram oEmbed success:', { 
      has_thumbnail: !!data.thumbnail_url,
      author: data.author_name 
    });

    return {
      thumbnail_url: data.thumbnail_url || null,
      title: data.title || data.author_name || null,
      thumbnail_width: typeof data.thumbnail_width === 'number' ? data.thumbnail_width : null,
      thumbnail_height: typeof data.thumbnail_height === 'number' ? data.thumbnail_height : null,
    };
  } catch (error) {
    console.error('[fetch-post-preview] Instagram oEmbed error:', error);
    return null;
  }
}

// Fetch Facebook thumbnail using official oEmbed API
async function fetchFacebookOembed(url: string): Promise<{ thumbnail_url: string | null; title: string | null; thumbnail_width: number | null; thumbnail_height: number | null } | null> {
  const metaToken = Deno.env.get('META_APP_TOKEN');
  
  if (!metaToken) {
    console.log('[fetch-post-preview] No META_APP_TOKEN, cannot fetch Facebook oEmbed');
    return null;
  }

  try {
    const oembedUrl = `https://graph.facebook.com/v18.0/oembed_post?url=${encodeURIComponent(url)}&access_token=${metaToken}`;
    
    console.log('[fetch-post-preview] Fetching Facebook oEmbed...');
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[fetch-post-preview] Facebook oEmbed failed: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log('[fetch-post-preview] Facebook oEmbed success');

    // Facebook oEmbed doesn't always return thumbnail_url
    // Try to extract from html if available
    let thumbnailUrl = data.thumbnail_url || null;
    
    if (!thumbnailUrl && data.html) {
      const imgMatch = data.html.match(/src="([^"]+)"/);
      if (imgMatch && imgMatch[1].includes('scontent')) {
        thumbnailUrl = imgMatch[1].replace(/&amp;/g, '&');
      }
    }

    return { thumbnail_url: thumbnailUrl, title: data.title || data.author_name || null, thumbnail_width: typeof data.thumbnail_width === "number" ? data.thumbnail_width : null, thumbnail_height: typeof data.thumbnail_height === "number" ? data.thumbnail_height : null };
  } catch (error) {
    console.error('[fetch-post-preview] Facebook oEmbed error:', error);
    return null;
  }
}

function extractFacebookNextUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (!/(^|\.)facebook\.com$/i.test(parsed.hostname)) return null;
    const next = parsed.searchParams.get('next');
    if (!next) return null;
    const nextUrl = new URL(decodeURIComponent(next));
    if (!/(^|\.)facebook\.com$/i.test(nextUrl.hostname)) return null;
    // Facebook share redirects add volatile rdid before share_url; the public
    // plugin rejects otherwise-valid story.php URLs when that param is present.
    nextUrl.searchParams.delete('rdid');
    const looksLikePost =
      /\/story\.php/i.test(nextUrl.pathname) ||
      /\/permalink\.php/i.test(nextUrl.pathname) ||
      /\/(?:photo|photos|posts|videos?|watch|reel)\b/i.test(nextUrl.pathname) ||
      nextUrl.searchParams.has('story_fbid') ||
      nextUrl.searchParams.has('fbid') ||
      nextUrl.searchParams.has('v');
    return looksLikePost ? nextUrl.toString() : null;
  } catch {
    return null;
  }
}

async function scrapeFacebookPlugin(url: string, fallbackUrl?: string): Promise<{ caption: string | null; image: string | null; title: string | null; imageWidth: number | null; imageHeight: number | null }> {
  const empty = { caption: null, image: null, title: null, imageWidth: null, imageHeight: null };
  const hrefs = [...new Set(([url, fallbackUrl].filter(Boolean) as string[]).flatMap(getFacebookPluginHrefs))];
  const endpoints = hrefs.flatMap((href) => [
    `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(href)}&show_text=true&width=500`,
    `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=true&width=500`,
  ]);

  for (const pluginUrl of endpoints) {
    try {
      const response = await fetch(pluginUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!response.ok) continue;

      const html = await response.text();
      const meta = extractArticleMetadata(html, pluginUrl);
      const imageInfo = extractFacebookPluginImage(html, pluginUrl);
      const caption = extractFacebookPluginCaption(html) || cleanFacebookCaption(meta.description);
      const title = cleanFacebookCaption(meta.title);

      if (caption || imageInfo.image || meta.image) {
        return {
          caption,
          image: imageInfo.image || meta.image,
          title,
          imageWidth: imageInfo.width,
          imageHeight: imageInfo.height,
        };
      }
    } catch (error) {
      console.error('[fetch-post-preview] Facebook plugin scrape error:', error);
    }
  }

  return empty;
}

function normalizeFacebookPluginHref(raw: string): string {
  try {
    const parsed = new URL(raw);
    if (/(^|\.)facebook\.com$/i.test(parsed.hostname)) {
      parsed.searchParams.delete('rdid');
      parsed.searchParams.delete('mibextid');
      parsed.searchParams.delete('__cft__');
      parsed.searchParams.delete('__tn__');
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

function getFacebookPluginHrefs(raw: string): string[] {
  const normalized = normalizeFacebookPluginHref(raw);
  const candidates = [normalized];
  try {
    const parsed = new URL(normalized);
    if (!/(^|\.)facebook\.com$/i.test(parsed.hostname)) return candidates;

    let storyId = parsed.searchParams.get('story_fbid') || parsed.searchParams.get('fbid');
    let pageId = parsed.searchParams.get('id');
    const postId = parsed.searchParams.get('post_id');
    if (postId?.includes('_')) {
      const [postPageId, postStoryId] = postId.split('_');
      pageId = pageId || postPageId;
      storyId = storyId || postStoryId;
    }
    const pathPost = parsed.pathname.match(/^\/(\d+)\/posts\/(\d+)/i);
    if (pathPost) {
      pageId = pageId || pathPost[1];
      storyId = storyId || pathPost[2];
    }

    if (storyId && pageId) {
      candidates.push(`https://www.facebook.com/story.php?story_fbid=${encodeURIComponent(storyId)}&id=${encodeURIComponent(pageId)}`);
      candidates.push(`https://www.facebook.com/permalink.php?story_fbid=${encodeURIComponent(storyId)}&id=${encodeURIComponent(pageId)}`);
      candidates.push(`https://www.facebook.com/${encodeURIComponent(pageId)}/posts/${encodeURIComponent(storyId)}`);
    }
  } catch {
    // keep normalized URL only
  }
  return candidates;
}

function extractFacebookPluginCaption(html: string): string | null {
  const candidates: string[] = [];
  const markerRegex = /data-testid=["']post_message["']/gi;
  let marker: RegExpExecArray | null;
  while ((marker = markerRegex.exec(html)) !== null) {
    const start = html.lastIndexOf('<', marker.index);
    const chunkStart = start >= 0 ? start : marker.index;
    const nextMessage = html.indexOf('data-testid="post_message"', marker.index + 1);
    const footerOffset = html.slice(marker.index).search(/(?:data-testid=["']UFI2CommentsCount["']|<form\b|aria-label=["']Like["'])/i);
    const nextFooter = footerOffset >= 0 ? marker.index + footerOffset : -1;
    const hardEnd = nextMessage > marker.index ? nextMessage : -1;
    const softEnd = nextFooter > marker.index ? nextFooter : -1;
    const end = [hardEnd, softEnd, chunkStart + 8000].filter((n) => n > chunkStart).sort((a, b) => a - b)[0] || chunkStart + 8000;
    candidates.push(html.slice(chunkStart, Math.min(html.length, end)));
  }

  // Some plugin responses contain server-rendered text without the test id but
  // keep it inside userContent/message containers.
  const legacy = html.match(/<(?:div|span)[^>]+(?:userContent|post-message|post_message)[^>]*>([\s\S]*?)<\/(?:div|span)>/i)?.[0];
  if (legacy) candidates.push(legacy);

  for (const candidate of candidates) {
    const cleaned = cleanFacebookCaption(stripHtml(candidate));
    if (cleaned) return cleaned;
  }
  return null;
}

function cleanFacebookCaption(text: string | null | undefined): string | null {
  if (!text) return null;
  let cleaned = stripFacebookBootstrapTail(decodeHtmlEntities(text))
    .replace(/\s+/g, ' ')
    .replace(/(?:^|\s)(?:See more|See Translation|See translation)(?:\s|$)/gi, ' ')
    .trim();
  cleaned = cleaned.replace(/^Facebook\s*[-–—:]?\s*/i, '').trim();
  const lower = cleaned.toLowerCase();
  if (
    !cleaned ||
    lower === 'facebook' ||
    lower.includes('log in to facebook') ||
    lower.includes('see posts, photos and more on facebook') ||
    isPageBootstrapDump(cleaned)
  ) return null;
  return cleaned.slice(0, 4000);
}

function stripFacebookBootstrapTail(value: string): string {
  const markers = [
    'function envFlush',
    'ServerJSQueue.add',
    'requireLazy',
    'Bootloader',
    'DTSGInitialData',
    'window.Env',
    'ajaxpipe_token',
    'enableBootload',
    'bumpVultureJSHash',
    'AsyncRequest',
    'IntlQtEventFalcoEvent',
  ];
  let earliest = -1;
  for (const marker of markers) {
    const idx = value.indexOf(marker);
    if (idx >= 0 && (earliest === -1 || idx < earliest)) earliest = idx;
  }
  return earliest >= 0 ? value.slice(0, earliest).trim() : value;
}

function isPageBootstrapDump(value: string): boolean {
  const stripped = stripFacebookBootstrapTail(value).trim();
  if (stripped && stripped !== value.trim()) return false;
  const text = value.slice(0, 4000);
  const markers = [
    'requireLazy',
    'Bootloader',
    'ServerJSQueue',
    'envFlush',
    'ajaxpipe_token',
    'enableBootload',
    'window.Env',
    'bumpVultureJSHash',
    'AsyncRequest',
    'IntlQtEventFalcoEvent',
    'DTSGInitialData',
  ];
  if (markers.some((marker) => text.includes(marker))) return true;
  if (text.length > 120) {
    const codey = (text.match(/[{}\[\]"`]/g) || []).length;
    if (codey / text.length > 0.18) return true;
  }
  return false;
}

function extractFacebookPluginImage(html: string, baseUrl: string): { image: string | null; width: number | null; height: number | null } {
  const images: Array<{ url: string; width: number | null; height: number | null; score: number }> = [];
  const imgRegex = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const tag = match[0];
    const raw =
      tag.match(/\s(?:data-src|src)=['"]([^'"]+)['"]/i)?.[1] ||
      tag.match(/\s(?:data-src|src)=([^\s>]+)/i)?.[1];
    if (!raw) continue;
    const resolved = resolveUrl(decodeHtmlEntities(raw).replace(/\\\//g, '/'), baseUrl);
    if (!resolved) continue;
    const lower = resolved.toLowerCase();
    if (!/(scontent|fbcdn)\./i.test(lower) && !lower.includes('scontent-')) continue;
    if (lower.includes('emoji') || lower.includes('rsrc.php') || lower.includes('static.xx.fbcdn.net')) continue;
    if (!isLikelyRealContentImage(resolved)) continue;

    const width = readAttrNumber(tag, 'width');
    const height = readAttrNumber(tag, 'height');
    const area = width && height ? width * height : 0;
    let score = area;
    if (/\/v\/t(?:39|45|51|15|1\.)/i.test(lower)) score += 10000;
    if (lower.includes('_n.jpg') || lower.includes('_n.png') || lower.includes('_n.webp')) score += 5000;
    if (lower.includes('p100x100') || lower.includes('s100x100') || lower.includes('cp0_dst')) score -= 20000;
    images.push({ url: resolved, width, height, score });
  }

  images.sort((a, b) => b.score - a.score);
  const best = images[0];
  return { image: best?.url || null, width: best?.width || null, height: best?.height || null };
}

function readAttrNumber(tag: string, attr: string): number | null {
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = tag.match(new RegExp(`\\s${escaped}=["']?(\\d+)`, 'i'))?.[1];
  const num = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(num) && num > 0 ? num : null;
}

// Store thumbnail permanently to avoid CDN expiration
async function storeThumbnailPermanently(postId: string, imageUrl: string): Promise<string | null> {
  try {
    // Guard: preview-only calls have no postId. Previously this produced the
    // shared storage path `thumbnails/undefined.<ext>` with upsert:true, so
    // every new preview overwrote the same object and unrelated posts ended up
    // sharing (and later mutating) one another's thumbnail. Never write to a
    // non-post-scoped path — just hand back the source URL.
    if (!postId) {
      console.log('[fetch-post-preview] No postId (preview-only) — skipping permanent storage');
      return imageUrl;
    }
    console.log(`[fetch-post-preview] Downloading and storing thumbnail for ${postId}`);
    
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.error(`[fetch-post-preview] Failed to download image: ${imageResponse.status}`);
      return imageUrl; // Return original URL as fallback
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageData = await imageResponse.arrayBuffer();
    
    // Check if we got actual image data
    if (imageData.byteLength < 1000) {
      console.error(`[fetch-post-preview] Image too small (${imageData.byteLength} bytes), likely empty`);
      return null;
    }

    // Determine file extension
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';

    const filePath = `thumbnails/${postId}.${ext}`;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('post-thumbnails')
      .upload(filePath, imageData, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[fetch-post-preview] Storage upload error:', uploadError);
      return imageUrl; // Return original as fallback
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('post-thumbnails')
      .getPublicUrl(filePath);

    console.log(`[fetch-post-preview] Stored thumbnail: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[fetch-post-preview] Store thumbnail error:', error);
    return imageUrl; // Return original as fallback
  }
}

async function fetchRedditPreview(url: string): Promise<{ thumbnail_url: string | null; title: string | null; description: string | null; post_data?: Record<string, unknown> | null }> {
  const canonicalUrl = await resolveRedditCanonicalUrl(url);
  const oembedData = await fetchRedditOembed(canonicalUrl || url);

  try {
    const res = await fetchRedditJson(canonicalUrl || url);
    
    if (res.ok) {
      const json = await res.json();
      const post = json[0]?.data?.children?.[0]?.data;
      const thumbnail = extractRedditMediaThumbnail(post);
      if (thumbnail || post?.title) {
        return {
          thumbnail_url: thumbnail,
          title: typeof post?.title === 'string' ? post.title : oembedData.title,
          description: typeof post?.selftext === 'string' && post.selftext.trim()
            ? post.selftext
            : (typeof post?.title === 'string' ? post.title : null),
          post_data: post ?? null,
        };
      }
    }
  } catch (e) {
    console.log('[fetch-post-preview] Reddit JSON fetch failed');
  }
  
  const ogData = await scrapeOgData(canonicalUrl || url);
  return {
    thumbnail_url: ogData.image && !isMisleadingRedditThumbnail(ogData.image) ? ogData.image : null,
    title: oembedData.title || ogData.title,
    description: ogData.description || oembedData.title,
    post_data: null,
  };
}

async function resolveRedditCanonicalUrl(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)reddit\.com$/i.test(parsed.hostname)) {
      return url;
    }
    // Only short-share URLs need to be resolved to their canonical /comments/ form.
    if (!/^\/(?:r|user)\/[^/]+\/s\/[^/]+\/?$/i.test(parsed.pathname)) {
      return url;
    }
    const accessToken = await getRedditInstalledClientToken();
    if (!accessToken) return null;

    const res = await fetch(`https://oauth.reddit.com${parsed.pathname}${parsed.search}`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Aelixto/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const location = res.headers.get('location');
    if (location && /\/comments\/[a-z0-9_]+/i.test(location)) return location;
    const body = await res.text();
    const bodyRedirect = body.match(/https:\/\/www\.reddit\.com\/(?:r|user)\/[^"'<>\s]+\/comments\/[a-z0-9_]+[^"'<>\s]*/i)?.[0];
    if (bodyRedirect) return bodyRedirect.replace(/&amp;/g, '&');
    const finalUrl = res.url || '';
    if (/\/comments\/[a-z0-9_]+/i.test(finalUrl)) return finalUrl;
    return null;
  } catch {
    return null;
  }
}

async function getRedditInstalledClientToken(): Promise<string | null> {
  try {
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa('6N9uN0krSDE-ig:')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Aelixto/1.0',
      },
      body: new URLSearchParams({
        grant_type: 'https://oauth.reddit.com/grants/installed_client',
        device_id: 'DO_NOT_TRACK_THIS_DEVICE',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.access_token === 'string' ? data.access_token : null;
  } catch {
    return null;
  }
}

async function fetchRedditOembed(url: string): Promise<{ title: string | null; description: string | null }> {
  try {
    const res = await fetch(`https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': 'Aelixto/1.0', 'Accept': 'application/json' },
    });
    if (!res.ok) return { title: null, description: null };
    const data = await res.json();
    return {
      title: typeof data.title === 'string' ? decodeHtmlEntities(data.title) : null,
      description: typeof data.author_name === 'string' ? `Posted by u/${data.author_name}` : null,
    };
  } catch {
    return { title: null, description: null };
  }
}

async function fetchRedditJson(url: string): Promise<Response> {
  const parsed = new URL(url);
  const jsonPath = parsed.pathname.replace(/\/$/, '') + '.json';
  const accessToken = await getRedditInstalledClientToken();

  if (accessToken) {
    const oauthRes = await fetch(`https://oauth.reddit.com${jsonPath}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Aelixto/1.0',
        'Accept': 'application/json',
      },
    });
    if (oauthRes.ok) return oauthRes;
  }

  const oldRedditUrl = `https://old.reddit.com${jsonPath}`;
  return fetch(oldRedditUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
}

// TikTok oEmbed — public endpoint, no auth, returns thumbnail_url + title
async function fetchTikTokOembed(url: string): Promise<{ thumbnail_url: string | null; title: string | null; thumbnail_width: number | null; thumbnail_height: number | null } | null> {
  try {
    // Normalize: strip query/tracking params, follow short links (vm.tiktok.com / vt.tiktok.com)
    let target = url.trim();
    if (/^https?:\/\/(vm|vt)\.tiktok\.com\//i.test(target)) {
      try {
        const head = await fetch(target, {
          method: 'GET',
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        if (head.url) target = head.url.split('?')[0];
      } catch { /* keep original */ }
    }
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`;
    console.log('[fetch-post-preview] Fetching TikTok oEmbed:', oembedUrl);
    const res = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      console.error(`[fetch-post-preview] TikTok oEmbed failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return {
      thumbnail_url: data.thumbnail_url || null,
      title: data.title || data.author_name || null,
      thumbnail_width: typeof data.thumbnail_width === 'number' ? data.thumbnail_width : null,
      thumbnail_height: typeof data.thumbnail_height === 'number' ? data.thumbnail_height : null,
    };
  } catch (e) {
    console.error('[fetch-post-preview] TikTok oEmbed error:', e);
    return null;
  }
}

function decodeRedditUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const decoded = decodeHtmlEntities(url);
  return /^https?:\/\//i.test(decoded) ? decoded : null;
}

function readNestedString(value: unknown, path: Array<string | number>): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (typeof key === 'number') {
      if (!Array.isArray(current)) return null;
      current = current[key];
    } else {
      if (!current || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[key];
    }
  }
  return typeof current === 'string' ? current : null;
}

function extractRedditMediaThumbnail(post: Record<string, unknown> | null | undefined): string | null {
  if (!post) return null;

  const preview = decodeRedditUrl(readNestedString(post, ['preview', 'images', 0, 'source', 'url']));
  if (preview) return preview;

  const mediaId = readNestedString(post, ['gallery_data', 'items', 0, 'media_id']);
  const galleryImage = mediaId ? readNestedString(post, ['media_metadata', mediaId, 's', 'u']) : null;
  const galleryThumb = decodeRedditUrl(galleryImage);
  if (galleryThumb) return galleryThumb;

  const oembedThumb = decodeRedditUrl(readNestedString(post, ['secure_media', 'oembed', 'thumbnail_url']))
    || decodeRedditUrl(readNestedString(post, ['media', 'oembed', 'thumbnail_url']));
  if (oembedThumb) return oembedThumb;

  const urlThumb = decodeRedditUrl(
    readNestedString(post, ['url_overridden_by_dest']) || readNestedString(post, ['url'])
  );
  if (urlThumb && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(urlThumb)) return urlThumb;

  const thumbnail = decodeRedditUrl(readNestedString(post, ['thumbnail']));
  if (thumbnail && !/(default|self|nsfw|spoiler)$/i.test(thumbnail)) return thumbnail;

  return null;
}

function isMisleadingRedditThumbnail(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes('images.unsplash.com') ||
    lower.includes('source.unsplash.com') ||
    lower.includes('redditstatic.com') ||
    lower.includes('share.redd.it/preview/post')
  );
}

function isGenericPlaceholderImage(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('images.unsplash.com') ||
    lower.includes('source.unsplash.com') ||
    lower.includes('/images/login/qrcodeloginpizza') ||
    lower.includes('static.xx.fbcdn.net') ||
    lower.includes('/rsrc.php/');
}

function stripHtml(text: string): string {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractXmlTag(xml: string, tag: string): string | null {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cdata = xml.match(new RegExp(`<${escaped}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escaped}>`, 'i'));
  if (cdata?.[1]) return decodeHtmlEntities(cdata[1].trim());
  const plain = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return plain?.[1] ? decodeHtmlEntities(plain[1].trim()) : null;
}

function getMediumFeedUrl(targetUrl: string): { feedUrl: string; postId: string | null; slug: string | null } | null {
  try {
    const parsed = new URL(targetUrl);
    const host = parsed.hostname.toLowerCase();
    const postId = parsed.pathname.match(/(?:-|\/p\/)([a-f0-9]{10,})(?:[/?#]|$)/i)?.[1] || null;
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const slug = lastSegment.replace(/-[a-f0-9]{10,}$/i, '').toLowerCase() || null;

    if (host === 'medium.com' || host === 'www.medium.com') {
      const author = parsed.pathname.match(/^\/@([^/]+)/)?.[1];
      return author ? { feedUrl: `https://medium.com/feed/@${author}`, postId, slug } : null;
    }

    if (host.endsWith('.medium.com')) {
      return { feedUrl: `https://${host}/feed`, postId, slug };
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchMediumRssPreview(url: string): Promise<{ title: string; image: string | null; description: string | null } | null> {
  const info = getMediumFeedUrl(url);
  if (!info) return null;

  try {
    const response = await fetch(info.feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/rss+xml,text/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;

    const xml = await response.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const item = items.find((entry) => {
      const link = extractXmlTag(entry, 'link') || '';
      const guid = extractXmlTag(entry, 'guid') || '';
      const haystack = `${link} ${guid} ${entry}`.toLowerCase();
      return (!!info.postId && haystack.includes(info.postId.toLowerCase())) || (!!info.slug && haystack.includes(info.slug));
    });
    if (!item) return null;

    const title = extractXmlTag(item, 'title');
    const content = extractXmlTag(item, 'content:encoded') || extractXmlTag(item, 'description') || '';
    const subtitle = content.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1];
    const firstParagraph = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    const image = content.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || null;

    if (!title) return null;
    return {
      title: stripHtml(title),
      image: image ? decodeHtmlEntities(image) : null,
      description: subtitle ? stripHtml(subtitle) : (firstParagraph ? stripHtml(firstParagraph) : null),
    };
  } catch (error) {
    console.error('[fetch-post-preview] Medium RSS error:', error);
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function scrapeOgData(url: string, userAgent?: string): Promise<{ image: string | null; title: string | null; description: string | null; imageWidth: number | null; imageHeight: number | null; videoWidth: number | null; videoHeight: number | null; hasVideo: boolean }> {
  const empty = { image: null, title: null, description: null, imageWidth: null, imageHeight: null, videoWidth: null, videoHeight: null, hasVideo: false };
  const buildHeaders = (ua: string) => ({
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  });

  const userAgents = userAgent
    ? [userAgent]
    : [
        // Some article/news sites reject Googlebot/browser UAs from cloud IPs
        // but still serve complete Open Graph metadata to social/link unfurlers.
        'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
        'facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      ];

  for (const ua of userAgents) {
    try {
      const response = await fetch(url, {
        headers: buildHeaders(ua),
        redirect: 'follow',
      });

      if (!response.ok) {
        console.log('[fetch-post-preview] OG scrape UA failed:', ua, response.status);
        continue;
      }

      const html = await response.text();
      const meta = extractArticleMetadata(html, response.url || url);
      const sizing = extractSizingFromHtml(html);
      if (meta.title || meta.image || meta.description) {
        return { ...meta, ...sizing };
      }
    } catch (error) {
      console.error('[fetch-post-preview] Scraping UA error:', ua, error);
    }
  }

  return empty;
}

function extractSizingFromHtml(html: string): { imageWidth: number | null; imageHeight: number | null; videoWidth: number | null; videoHeight: number | null; hasVideo: boolean } {
  const tolerantMeta = (want: string): string | null => {
    const w = want.toLowerCase();
    const tagRegex = /<meta\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = tagRegex.exec(html)) !== null) {
      const tag = m[0];
      const p = tag.match(/\s(property|name|itemprop)\s*=\s*["']?([^"'\s>]+)["']?/i);
      if (!p || p[2].toLowerCase() !== w) continue;
      const c =
        tag.match(/\scontent\s*=\s*"([^"]*)"/i) ||
        tag.match(/\scontent\s*=\s*'([^']*)'/i) ||
        tag.match(/\scontent\s*=\s*([^\s>]+)/i);
      if (c?.[1]) return decodeHtmlEntities(c[1]).trim();
    }
    return null;
  };
  const metaNum = (name: string): number | null => {
    const v = tolerantMeta(name);
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const hasVideo = !!tolerantMeta('og:video')
    || !!tolerantMeta('og:video:secure_url')
    || !!tolerantMeta('og:video:url')
    || (tolerantMeta('twitter:card')?.toLowerCase() === 'player')
    || (tolerantMeta('og:type')?.toLowerCase().startsWith('video') ?? false);
  return {
    imageWidth: metaNum('og:image:width'),
    imageHeight: metaNum('og:image:height'),
    videoWidth: metaNum('og:video:width'),
    videoHeight: metaNum('og:video:height'),
    hasVideo,
  };
}

function isThreadsProfilePicture(url: string): boolean {
  const lower = url.toLowerCase();
  if (!lower) return false;
  // Threads profile pictures live on cdninstagram.com under /v/... with
  // a profile_pic encode tag. Other Threads media (photos/videos) live
  // under different paths or scontent-*.cdninstagram.com/o1/v/t2/.
  if ((lower.includes('cdninstagram.com/v/') || lower.includes('fbcdn.net/v/')) && lower.includes('profile_pic')) return true;
  if (lower.includes('/t51.82787-19/')) return true;
  if (lower.includes('stp=dst-jpg') && lower.includes('profile_pic')) return true;
  // Meta CDN profile-picture buckets always end in "-19"
  // (t51.2885-19, t51.82787-19, t51.30982-19, ...). Any asset served
  // from one of those buckets is an avatar, never the post's own media.
  if (/\/t\d+\.[\d-]*-19\//.test(lower)) return true;
  if (/[?&]stp=[^&]*_19/.test(lower)) return true;
  if (lower.includes('profile_pic')) return true;
  try {
    const parsed = new URL(url);
    const efg = parsed.searchParams.get('efg');
    if (efg) {
      const decoded = atob(efg.replace(/-/g, '+').replace(/_/g, '/'));
      if (decoded.toLowerCase().includes('profile_pic')) return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * Universal article metadata extractor. Works across any website by trying
 * (in order): Open Graph, Twitter Cards, JSON-LD structured data, the first
 * <h1> in the document, and the first reasonable <img> inside <article>/<main>
 * or the page body. Resolves relative URLs against the page's final URL.
 */
export function extractArticleMetadata(
  html: string,
  baseUrl: string
): { image: string | null; title: string | null; description: string | null } {
  type JsonLdValue = string | { url?: string; '@id'?: string } | Array<string | { url?: string; '@id'?: string }> | null | undefined;
  type JsonLdNode = Record<string, JsonLdValue>;

  const meta = (name: string): string | null => {
    const want = name.toLowerCase();
    const tagRegex = /<meta\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = tagRegex.exec(html)) !== null) {
      const tag = m[0];
      const propMatch = tag.match(/\s(property|name|itemprop)\s*=\s*["']?([^"'\s>]+)["']?/i);
      if (!propMatch || propMatch[2].toLowerCase() !== want) continue;
      const contentMatch =
        tag.match(/\scontent\s*=\s*"([^"]*)"/i) ||
        tag.match(/\scontent\s*=\s*'([^']*)'/i) ||
        tag.match(/\scontent\s*=\s*([^\s>]+)/i);
      if (contentMatch?.[1]) return decodeHtmlEntities(contentMatch[1]).trim();
    }
    return null;
  };

  // --- JSON-LD ---
  let jsonLdTitle: string | null = null;
  let jsonLdImage: string | null = null;
  let jsonLdDesc: string | null = null;
  const ldBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldBlocks) {
    const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    if (!inner) continue;
    try {
      const parsed = JSON.parse(inner) as JsonLdNode | JsonLdNode[];
      const graph = !Array.isArray(parsed) && Array.isArray(parsed['@graph']) ? parsed['@graph'] : null;
      const nodes: JsonLdNode[] = Array.isArray(parsed) ? parsed : (graph as JsonLdNode[] | null) || [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const t = node.headline || node.name;
        const d = node.description;
        let img = node.image || node.thumbnailUrl || node.thumbnail;
        if (Array.isArray(img)) img = img[0];
        if (img && typeof img === 'object') img = img.url || img['@id'] || null;
        if (!jsonLdTitle && typeof t === 'string') jsonLdTitle = t.trim();
        if (!jsonLdDesc && typeof d === 'string') jsonLdDesc = d.trim();
        if (!jsonLdImage && typeof img === 'string') jsonLdImage = img.trim();
        if (jsonLdTitle && jsonLdImage) break;
      }
    } catch { /* ignore malformed JSON-LD */ }
    if (jsonLdTitle && jsonLdImage) break;
  }

  // --- Title ---
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const h1Tag = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title =
    meta('og:title') ||
    meta('twitter:title') ||
    jsonLdTitle ||
    (h1Tag ? decodeHtmlEntities(h1Tag.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : null) ||
    (titleTag ? decodeHtmlEntities(titleTag.trim()) : null);

  // --- Description ---
  const description =
    meta('og:description') ||
    meta('twitter:description') ||
    meta('description') ||
    jsonLdDesc;

  // --- Image ---
  let image =
    meta('og:image') ||
    meta('og:image:secure_url') ||
    meta('og:image:url') ||
    meta('twitter:image') ||
    meta('twitter:image:src') ||
    jsonLdImage ||
    findFirstContentImage(html);

  if (image) {
    image = resolveUrl(image, baseUrl);
    if (image && !isLikelyRealContentImage(image)) image = findFirstContentImage(html);
    if (image) image = resolveUrl(image, baseUrl);
  }

  return { image: image || null, title: title || null, description: description || null };
}

function findFirstContentImage(html: string): string | null {
  // Prefer images inside <article> / <main>; fall back to body.
  const scopes: string[] = [];
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch) scopes.push(articleMatch[0]);
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  if (mainMatch) scopes.push(mainMatch[0]);
  scopes.push(html);

  for (const scope of scopes) {
    const imgRegex = /<img[^>]+>/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRegex.exec(scope)) !== null) {
      const tag = m[0];
      const src =
        tag.match(/\s(?:data-src|data-original|data-lazy-src|data-srcset|srcset)=["']([^"']+)["']/i)?.[1] ||
        tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
      if (!src) continue;
      // srcset → take first URL
      const candidate = decodeHtmlEntities(src.split(',')[0].trim().split(/\s+/)[0]);
      if (isLikelyRealContentImage(candidate)) return candidate;
    }
  }
  return null;
}

function isLikelyRealContentImage(url: string): boolean {
  if (!url) return false;
  const u = url.trim();
  if (!u || u.startsWith('data:')) return false;
  if (/\.svg(\?|#|$)/i.test(u)) return false;
  const lower = u.toLowerCase();
  const blockedHints = [
    'sprite', 'icon', 'favicon', 'logo', 'avatar', 'profile-photo',
    'blank.gif', 'spacer.gif', 'pixel.gif', '1x1', 'tracking', 'analytics',
    'badge', 'emoji',
  ];
  if (blockedHints.some((h) => lower.includes(h))) return false;
  // Reject tiny dimensions hinted in URL (?w=16, =32x32)
  if (/[?&=_/-](?:w|width)=(?:8|16|24|32|48|64)\b/i.test(u)) return false;
  if (/(^|[/_-])(?:16|24|32|48|64)x(?:16|24|32|48|64)([._/]|$)/i.test(u)) return false;
  return true;
}

function resolveUrl(maybeRelative: string, baseUrl: string): string | null {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

// LinkedIn — extract activity / share / ugcPost ID from any post URL flavour.
function extractLinkedInUrn(url: string): string | null {
  if (!url) return null;
  // urn:li:activity:1234... already in the URL
  const direct = url.match(/urn(?::|%3A)li(?::|%3A)(activity|share|ugcPost)(?::|%3A)(\d{6,})/i);
  if (direct) return `urn:li:${direct[1]}:${direct[2]}`;
  // /posts/<slug>-activity-1234567890-abcd
  const activity = url.match(/-(activity|share|ugcPost)-(\d{6,})/i);
  if (activity) return `urn:li:${activity[1]}:${activity[2]}`;
  // /feed/update/urn:li:.../
  const update = url.match(/\/feed\/update\/(urn:li:[a-zA-Z]+:\d+)/i);
  if (update) return update[1];
  return null;
}

async function fetchLinkedInEmbedCaption(url: string): Promise<{ caption: string | null; image: string | null }> {
  const urn = extractLinkedInUrn(url);
  if (!urn) return { caption: null, image: null };
  const embedUrl = `https://www.linkedin.com/embed/feed/update/${urn}`;
  try {
    const res = await fetch(embedUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return { caption: null, image: null };
    const html = await res.text();

    // LinkedIn nests commentary inside many spans/divs; a non-greedy match on
    // the first `</div>` truncates the post. Extract by finding the opening
    // commentary container and walking tags to its matching close.
    let caption: string | null = null;

    const containerStarts = [
      /<div\b[^>]*class="[^"]*feed-shared-update-v2__commentary[^"]*"[^>]*>/i,
      /<div\b[^>]*class="[^"]*attributed-text-segment-list__container[^"]*"[^>]*>/i,
      /<div\b[^>]*class="[^"]*attributed-text-segment-list__content[^"]*"[^>]*>/i,
      /<div\b[^>]*data-test-id="main-feed-activity-card__commentary"[^>]*>/i,
      /<p\b[^>]*class="[^"]*commentary[^"]*"[^>]*>/i,
    ];
    for (const re of containerStarts) {
      const m = html.match(re);
      if (!m || m.index === undefined) continue;
      const inner = extractBalancedTag(html, m.index, m[0].startsWith('<p') ? 'p' : 'div');
      if (!inner) continue;
      const text = htmlBlockToText(inner);
      if (text && text.length >= 2) { caption = text; break; }
    }

    if (!caption) {
      // Some embed responses ship the post payload as escaped JSON inside an
      // <code> tag. The full commentary text is on a "text" field.
      const codeBlocks = html.match(/<code[^>]*>([\s\S]*?)<\/code>/gi) || [];
      for (const block of codeBlocks) {
        const json = decodeHtmlEntities(block.replace(/<\/?code[^>]*>/gi, '')).trim();
        if (!json.startsWith('{') && !json.startsWith('[')) continue;
        try {
          const parsed = JSON.parse(json);
          const found = findCommentaryText(parsed);
          if (found && found.length > (caption?.length || 0)) caption = found;
        } catch { /* ignore */ }
      }
    }

    if (!caption) {
      const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1];
      if (ogDesc) caption = decodeHtmlEntities(ogDesc).trim();
    }

    // Hero/preview image from the embed page (avoids generic LinkedIn logo).
    let image: string | null = null;
    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
    if (ogImage) image = decodeHtmlEntities(ogImage).trim();

    return { caption: caption || null, image: image || null };
  } catch (error) {
    console.error('[fetch-post-preview] LinkedIn embed scrape failed:', error);
    return { caption: null, image: null };
  }
}

function htmlBlockToText(snippet: string): string {
  return decodeHtmlEntities(
    snippet
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n\n')
      .replace(/<\/div\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Walk an HTML string starting at the index of an opening tag and return the
// inner content up to its matching closing tag, accounting for nesting.
function extractBalancedTag(html: string, openIndex: number, tagName: string): string | null {
  const openRe = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
  openRe.lastIndex = openIndex;
  const openMatch = openRe.exec(html);
  if (!openMatch) return null;
  const innerStart = openMatch.index + openMatch[0].length;
  let depth = 1;
  openRe.lastIndex = innerStart;
  closeRe.lastIndex = innerStart;
  while (depth > 0) {
    const nextOpen = openRe.exec(html);
    const nextClose = closeRe.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      closeRe.lastIndex = nextOpen.index + nextOpen[0].length;
      continue;
    }
    depth -= 1;
    if (depth === 0) return html.slice(innerStart, nextClose.index);
    openRe.lastIndex = nextClose.index + nextClose[0].length;
  }
  return null;
}

// Recursively search a parsed JSON payload for the longest plausible
// commentary string. LinkedIn embed payloads expose post text on fields like
// `text`, `commentary`, or `attributedText.text`.
function findCommentaryText(value: unknown, depth = 0): string | null {
  if (depth > 6 || value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 40 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    let best: string | null = null;
    for (const item of value) {
      const found = findCommentaryText(item, depth + 1);
      if (found && (!best || found.length > best.length)) best = found;
    }
    return best;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const preferredKeys = ['text', 'commentary', 'commentaryV2', 'attributedText'];
    let best: string | null = null;
    for (const key of preferredKeys) {
      if (key in obj) {
        const found = findCommentaryText(obj[key], depth + 1);
        if (found && (!best || found.length > best.length)) best = found;
      }
    }
    if (best) return best;
    for (const key of Object.keys(obj)) {
      if (preferredKeys.includes(key)) continue;
      const found = findCommentaryText(obj[key], depth + 1);
      if (found && (!best || found.length > best.length)) best = found;
    }
    return best;
  }
  return null;
}