import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface UniversalContent {
  url: string;
  platform: string;
  media_type: 'video' | 'image' | 'text' | 'carousel';
  media_url?: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  author_name?: string;
  author_username?: string;
  author_avatar?: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  views_count?: number;
  created_at?: string;
  raw_data?: Record<string, unknown>;
}

// Detect platform from URL
function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) return 'instagram';
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com')) return 'tiktok';
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'x';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) return 'facebook';
  if (urlLower.includes('reddit.com') || urlLower.includes('redd.it')) return 'reddit';
  if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) return 'pinterest';
  if (urlLower.includes('spotify.com')) return 'spotify';
  return 'unknown';
}

// Decode HTML entities
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

// Fetch OpenGraph data from page
async function fetchOpenGraph(url: string): Promise<Record<string, string>> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      console.log(`[fetch-universal-content] OpenGraph fetch failed: ${response.status}`);
      return {};
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) return {};

    const ogData: Record<string, string> = {};
    
    // Extract meta tags
    const metaTags = doc.querySelectorAll('meta');
    for (const meta of metaTags) {
      const property = meta.getAttribute('property') || meta.getAttribute('name');
      const content = meta.getAttribute('content');
      if (property && content) {
        ogData[property] = decodeHtmlEntities(content);
      }
    }

    // Extract title
    const titleEl = doc.querySelector('title');
    if (titleEl?.textContent) {
      ogData['page_title'] = decodeHtmlEntities(titleEl.textContent);
    }

    console.log(`[fetch-universal-content] OpenGraph extracted:`, Object.keys(ogData).join(', '));
    return ogData;
  } catch (error) {
    console.error(`[fetch-universal-content] OpenGraph error:`, error);
    return {};
  }
}

// Fetch oEmbed data
async function fetchOEmbed(url: string, platform: string): Promise<Record<string, unknown> | null> {
  const oEmbedEndpoints: Record<string, string> = {
    instagram: `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&omitscript=true`,
    youtube: `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    x: `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
    twitter: `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
    tiktok: `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    pinterest: `https://api.pinterest.com/v3/oembed?url=${encodeURIComponent(url)}`,
  };

  const endpoint = oEmbedEndpoints[platform];
  if (!endpoint) return null;

  try {
    console.log(`[fetch-universal-content] Fetching oEmbed from ${platform}`);
    const response = await fetch(endpoint, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[fetch-universal-content] oEmbed error for ${platform}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[fetch-universal-content] oEmbed success for ${platform}:`, JSON.stringify(data).substring(0, 300));
    return data;
  } catch (error) {
    console.error(`[fetch-universal-content] oEmbed fetch error:`, error);
    return null;
  }
}

// Extract Instagram thumbnail from oEmbed HTML
function extractInstagramThumbnailFromHtml(html: string): string | undefined {
  // Instagram oEmbed sometimes has a background-image url in the HTML
  const bgMatch = html.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/);
  if (bgMatch) return decodeHtmlEntities(bgMatch[1]);
  
  // Or a data-instgrm-captioned image
  const imgMatch = html.match(/<img[^>]+src=['"]([^'"]+)['"]/);
  if (imgMatch) return decodeHtmlEntities(imgMatch[1]);
  
  return undefined;
}

// Extract username from URL
function extractUsernameFromUrl(url: string, platform: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    switch (platform) {
      case 'instagram': {
        // instagram.com/p/xxx or instagram.com/username/
        const match = path.match(/^\/([^\/]+)/);
        if (match && !['p', 'reel', 'reels', 'stories', 'tv'].includes(match[1])) {
          return match[1];
        }
        // For /p/xxx posts, try to extract from /p/xxx?igsh=... pattern or next segment
        const postMatch = path.match(/^\/p\/([^\/]+)/);
        if (postMatch) return undefined; // Will get from OG
        break;
      }
      case 'tiktok': {
        // tiktok.com/@username/video/xxx
        const match = path.match(/^\/@([^\/]+)/);
        if (match) return match[1];
        break;
      }
      case 'youtube': {
        // youtube.com/@channel or youtube.com/c/channel
        const match = path.match(/^\/@([^\/]+)/) || path.match(/^\/c\/([^\/]+)/);
        if (match) return match[1];
        break;
      }
      case 'x':
      case 'twitter': {
        // x.com/username/status/xxx
        const match = path.match(/^\/([^\/]+)/);
        if (match && !['i', 'home', 'explore', 'notifications'].includes(match[1])) {
          return match[1];
        }
        break;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

// Normalize all data into standard format
function normalizeContent(
  url: string,
  platform: string,
  ogData: Record<string, string>,
  oembedData: Record<string, unknown> | null
): UniversalContent {
  // Determine media type
  let mediaType: 'video' | 'image' | 'text' | 'carousel' = 'image';
  if (platform === 'tiktok' || platform === 'youtube') {
    mediaType = 'video';
  } else if (ogData['og:type'] === 'video' || ogData['og:video']) {
    mediaType = 'video';
  }

  // Extract thumbnail - prioritize oEmbed, then OG
  let thumbnailUrl = 
    oembedData?.thumbnail_url as string ||
    ogData['og:image'] ||
    ogData['twitter:image'] ||
    ogData['twitter:image:src'] ||
    undefined;

  // For Instagram, try to extract from oEmbed HTML if no direct thumbnail
  if (platform === 'instagram' && !thumbnailUrl && oembedData?.html) {
    thumbnailUrl = extractInstagramThumbnailFromHtml(oembedData.html as string);
  }

  // Extract media URL (video if available)
  const mediaUrl = 
    ogData['og:video'] ||
    ogData['og:video:url'] ||
    thumbnailUrl;

  // Extract author info - for Instagram, prefer og:title which has "Name on Instagram: "
  let authorName: string | undefined;
  let authorUsername: string | undefined;
  
  if (platform === 'instagram') {
    // Extract from og:title: "Richard Laursen on Instagram: "caption""
    const titleMatch = (ogData['og:title'] || '').match(/^([^:]+) on Instagram:/);
    if (titleMatch) {
      authorName = titleMatch[1].trim();
    }
    // Extract username from og:url: "https://www.instagram.com/richardlaursen1/reel/DO9-o6giLEU/"
    const urlMatch = (ogData['og:url'] || '').match(/instagram\.com\/([^\/]+)\//);
    if (urlMatch && !['p', 'reel', 'reels', 'stories', 'tv'].includes(urlMatch[1])) {
      authorUsername = urlMatch[1];
    }
  } else {
    authorName = oembedData?.author_name as string || undefined;
    authorUsername = extractUsernameFromUrl(url, platform) || (oembedData?.author_url as string)?.split('/').pop();
  }

  // For Twitter/X, extract from oEmbed author_name
  if ((platform === 'x' || platform === 'twitter') && oembedData?.author_name) {
    authorName = oembedData.author_name as string;
  }

  // Extract title and description
  let title = 
    oembedData?.title as string ||
    ogData['og:title'] ||
    ogData['twitter:title'] ||
    ogData['page_title'] ||
    undefined;

  let description = 
    ogData['og:description'] ||
    ogData['twitter:description'] ||
    ogData['description'] ||
    undefined;

  // Clean up description (remove "X likes, Y comments" prefix from Instagram)
  if (description && platform === 'instagram') {
    // Pattern: "946K likes, 1,481 comments - richardlaursen1 on September 23, 2025: "is this..."
    const cleanMatch = description.match(/^[\d,]+[KMB]?\s*likes?,\s*[\d,]+[KMB]?\s*comments?\s*-\s*([^\s]+)\s+on\s+[^:]+:\s*[""]?(.+)$/s);
    if (cleanMatch) {
      authorUsername = authorUsername || cleanMatch[1].trim();
      description = cleanMatch[2].replace(/[""\.]?\s*$/, '').trim();
    } else {
      // Alternative pattern: "X likes, Y comments - username: caption"
      const altMatch = description.match(/^[\d,]+[KMB]?\s*likes?,\s*[\d,]+[KMB]?\s*comments?\s*-\s*([^:]+):\s*(.+)$/s);
      if (altMatch) {
        authorUsername = authorUsername || altMatch[1].trim();
        description = altMatch[2].trim();
      }
    }
  }

  // TikTok specific: extract from oEmbed
  if (platform === 'tiktok' && oembedData) {
    thumbnailUrl = oembedData.thumbnail_url as string || thumbnailUrl;
    authorName = oembedData.author_name as string || authorName;
    authorUsername = oembedData.author_unique_id as string || (oembedData.author_url as string)?.split('@').pop() || authorUsername;
  }

  // YouTube specific
  if (platform === 'youtube' && oembedData) {
    authorName = oembedData.author_name as string || authorName;
    thumbnailUrl = oembedData.thumbnail_url as string || thumbnailUrl;
    title = oembedData.title as string || title;
  }

  // Decode any remaining HTML entities
  if (title) title = decodeHtmlEntities(title);
  if (description) description = decodeHtmlEntities(description);
  if (authorName) authorName = decodeHtmlEntities(authorName);
  if (thumbnailUrl) thumbnailUrl = decodeHtmlEntities(thumbnailUrl);

  return {
    url,
    platform,
    media_type: mediaType,
    media_url: mediaUrl,
    thumbnail_url: thumbnailUrl,
    title,
    description,
    author_name: authorName,
    author_username: authorUsername,
    raw_data: { og: ogData, oembed: oembedData },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, postId, storeResult } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platform = detectPlatform(url);
    console.log(`[fetch-universal-content] Processing ${platform} URL: ${url}`);

    // Fetch data in parallel
    const [ogData, oembedData] = await Promise.all([
      fetchOpenGraph(url),
      fetchOEmbed(url, platform),
    ]);

    const content = normalizeContent(url, platform, ogData, oembedData);

    // If no thumbnail found, return error
    if (!content.thumbnail_url && !content.description) {
      console.log(`[fetch-universal-content] No content extracted for ${url}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch content from platform', partial: content }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If postId provided and storeResult is true, update the post with raw_json_data
    if (postId && storeResult) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase
        .from('posts')
        .update({
          raw_json_data: content,
          thumbnail_url: content.thumbnail_url,
        })
        .eq('id', postId);

      if (updateError) {
        console.error('[fetch-universal-content] Failed to store result:', updateError);
      } else {
        console.log(`[fetch-universal-content] Stored raw_json_data for post ${postId}`);
      }
    }

    return new Response(
      JSON.stringify(content),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fetch-universal-content] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
