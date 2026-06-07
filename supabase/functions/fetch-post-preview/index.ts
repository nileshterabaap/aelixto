import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postId, url, platform } = await req.json();
    
    console.log(`[fetch-post-preview] Processing postId=${postId}, platform=${platform}, url=${url}`);

    if (!postId || !url) {
      return new Response(JSON.stringify({ error: 'Missing postId or url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let thumbnailUrl: string | null = null;
    let previewText: string | null = null;
    let previewTitle: string | null = null;

    // YouTube special handling - reliable thumbnails
    if (platform === 'youtube') {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
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
    }
    // Facebook - use official oEmbed API with Meta token
    else if (platform === 'facebook') {
      const oembedData = await fetchFacebookOembed(url);
      if (oembedData?.thumbnail_url) {
        thumbnailUrl = await storeThumbnailPermanently(postId, oembedData.thumbnail_url);
      }
    }
    // Reddit special handling
    else if (platform === 'reddit') {
      const redditData = await fetchRedditPreview(url);
      thumbnailUrl = redditData.thumbnail_url;
      previewTitle = redditData.title;
      previewText = redditData.description || redditData.title;
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
      }
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
      const ogData = await scrapeOgData(url);
      thumbnailUrl = ogData.image && !isGenericPlaceholderImage(ogData.image) ? ogData.image : null;
      previewText = ogData.description || ogData.title;
      if (ogData.title) previewTitle = ogData.title;
    }

    // Update database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const updatePayload: Record<string, string | null> = { thumbnail_url: thumbnailUrl, preview_text: previewText };
    if (previewTitle) {
      updatePayload.title = previewTitle;
      updatePayload.preview_title = previewTitle;
    }
    if (thumbnailUrl) updatePayload.preview_image_url = thumbnailUrl;

    const { error: updateError } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', postId);

    if (updateError) {
      console.error('[fetch-post-preview] DB update error:', updateError);
    } else {
      console.log(`[fetch-post-preview] Updated post ${postId} with thumbnail: ${thumbnailUrl}`);
    }

    return new Response(
      JSON.stringify({ thumbnail_url: thumbnailUrl, title: previewTitle, preview_text: previewText }),
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
async function fetchInstagramOembed(url: string): Promise<{ thumbnail_url: string | null; title: string | null } | null> {
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
      title: data.title || data.author_name || null
    };
  } catch (error) {
    console.error('[fetch-post-preview] Instagram oEmbed error:', error);
    return null;
  }
}

// Fetch Facebook thumbnail using official oEmbed API
async function fetchFacebookOembed(url: string): Promise<{ thumbnail_url: string | null } | null> {
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

    return { thumbnail_url: thumbnailUrl };
  } catch (error) {
    console.error('[fetch-post-preview] Facebook oEmbed error:', error);
    return null;
  }
}

// Store thumbnail permanently to avoid CDN expiration
async function storeThumbnailPermanently(postId: string, imageUrl: string): Promise<string | null> {
  try {
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

async function fetchRedditPreview(url: string): Promise<{ thumbnail_url: string | null; title: string | null; description: string | null }> {
  const canonicalUrl = await resolveRedditCanonicalUrl(url);
  const oembedData = await fetchRedditOembed(canonicalUrl || url);

  try {
    // Reddit now blocks unauthenticated JSON fetches (both www and old).
    // Use the OAuth installed-client token against oauth.reddit.com instead.
    const parsed = new URL(canonicalUrl || url);
    const pathOnly = parsed.pathname.replace(/\/$/, '') + '.json';
    const token = await getRedditInstalledClientToken();
    const res = await fetch(`https://oauth.reddit.com${pathOnly}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'User-Agent': 'Aelixto/1.0',
        'Accept': 'application/json',
      },
    });
    
    if (res.ok) {
      const json = await res.json();
      const post = json[0]?.data?.children?.[0]?.data;
      const thumbnail = extractRedditMediaThumbnail(post);
      if (thumbnail || post?.title) {
        return {
          thumbnail_url: thumbnail,
          title: typeof post?.title === 'string' ? post.title : oembedData.title,
          description: typeof post?.selftext === 'string' && post.selftext.trim() ? post.selftext : oembedData.description,
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
    description: oembedData.description || ogData.description,
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

// TikTok oEmbed — public endpoint, no auth, returns thumbnail_url + title
async function fetchTikTokOembed(url: string): Promise<{ thumbnail_url: string | null; title: string | null } | null> {
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
  return lower.includes('images.unsplash.com') || lower.includes('source.unsplash.com');
}

function isGenericPlaceholderImage(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('images.unsplash.com') || lower.includes('source.unsplash.com');
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

async function scrapeOgData(url: string): Promise<{ image: string | null; title: string | null; description: string | null }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return { image: null, title: null, description: null };
    }

    const html = await response.text();
    return extractArticleMetadata(html, response.url || url);
  } catch (error) {
    console.error('[fetch-post-preview] Scraping error:', error);
    return { image: null, title: null, description: null };
  }
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
  const meta = (name: string): string | null => {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, 'i'),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return decodeHtmlEntities(m[1]).trim();
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
      const parsed = JSON.parse(inner);
      const nodes: any[] = Array.isArray(parsed) ? parsed : (parsed['@graph'] && Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed]);
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const t = node.headline || node.name;
        const d = node.description;
        let img: any = node.image || node.thumbnailUrl || node.thumbnail;
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