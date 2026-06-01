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
      thumbnailUrl = await fetchRedditThumbnail(url);
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
    // Generic scraping for other platforms
    else {
      const ogData = await scrapeOgData(url);
      thumbnailUrl = ogData.image;
      previewText = ogData.description || ogData.title;
    }

    // Update database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from('posts')
      .update({ thumbnail_url: thumbnailUrl, preview_text: previewText })
      .eq('id', postId);

    if (updateError) {
      console.error('[fetch-post-preview] DB update error:', updateError);
    } else {
      console.log(`[fetch-post-preview] Updated post ${postId} with thumbnail: ${thumbnailUrl}`);
    }

    return new Response(
      JSON.stringify({ thumbnail_url: thumbnailUrl, preview_text: previewText }),
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

async function fetchRedditThumbnail(url: string): Promise<string | null> {
  try {
    let jsonUrl = url.split('?')[0].replace(/\/$/, '');
    jsonUrl = jsonUrl.replace('www.reddit.com', 'old.reddit.com');
    jsonUrl += '.json';
    const res = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    
    if (res.ok) {
      const json = await res.json();
      const post = json[0]?.data?.children?.[0]?.data;
      const thumbnail = extractRedditMediaThumbnail(post);
      if (thumbnail) return thumbnail;
    }
  } catch (e) {
    console.log('[fetch-post-preview] Reddit JSON fetch failed');
  }
  
  const ogData = await scrapeOgData(url);
  if (ogData.image && !isMisleadingRedditThumbnail(ogData.image)) return ogData.image;
  return null;
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return { image: null, title: null, description: null };
    }

    const html = await response.text();

    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    
    const image = ogImageMatch?.[1] ? decodeHtmlEntities(ogImageMatch[1]) : 
                  (twitterImageMatch?.[1] ? decodeHtmlEntities(twitterImageMatch[1]) : null);

    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const title = ogTitleMatch?.[1] ? decodeHtmlEntities(ogTitleMatch[1]) : null;

    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const description = ogDescMatch?.[1] ? decodeHtmlEntities(ogDescMatch[1]) : null;

    return { image, title, description };
  } catch (error) {
    console.error('[fetch-post-preview] Scraping error:', error);
    return { image: null, title: null, description: null };
  }
}