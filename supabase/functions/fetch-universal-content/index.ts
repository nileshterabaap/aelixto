import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface OutstandResponse {
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

// Fetch content from Outstand API
async function fetchFromOutstand(url: string, platform: string, apiKey: string): Promise<OutstandResponse | null> {
  const baseUrl = 'https://api.outstand.dev/v1';
  
  try {
    // Platform-specific endpoints
    const endpoints: Record<string, string> = {
      instagram: '/instagram/post',
      tiktok: '/tiktok/video',
      youtube: '/youtube/video',
      x: '/twitter/tweet',
      facebook: '/facebook/post',
      reddit: '/reddit/post',
      pinterest: '/pinterest/pin',
    };

    const endpoint = endpoints[platform] || '/oembed';
    
    console.log(`[fetch-universal-content] Fetching ${platform} content from ${endpoint}`);
    
    const response = await fetch(`${baseUrl}${endpoint}?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[fetch-universal-content] Outstand API error: ${response.status}`);
      
      // Fallback to oEmbed for unsupported platforms
      if (response.status === 404 || response.status === 400) {
        const fallbackResponse = await fetch(`${baseUrl}/oembed?url=${encodeURIComponent(url)}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          return normalizeResponse(data, url, platform);
        }
      }
      return null;
    }

    const data = await response.json();
    return normalizeResponse(data, url, platform);
  } catch (error) {
    console.error(`[fetch-universal-content] Error fetching from Outstand:`, error);
    return null;
  }
}

// Normalize response to standard format
function normalizeResponse(data: any, url: string, platform: string): OutstandResponse {
  // Determine media type based on platform and content
  let mediaType: 'video' | 'image' | 'text' | 'carousel' = 'image';
  if (platform === 'tiktok' || platform === 'youtube') {
    mediaType = 'video';
  } else if (platform === 'x' || platform === 'reddit') {
    mediaType = data.media_url ? 'image' : 'text';
  } else if (data.media_type === 'carousel' || data.is_carousel) {
    mediaType = 'carousel';
  } else if (data.video_url || data.media_type === 'video') {
    mediaType = 'video';
  }

  return {
    url,
    platform,
    media_type: mediaType,
    media_url: data.video_url || data.media_url || data.image_url || data.thumbnail_url,
    thumbnail_url: data.thumbnail_url || data.image_url || data.preview_image,
    title: data.title || data.caption?.substring(0, 100),
    description: data.caption || data.description || data.text,
    author_name: data.author_name || data.user?.name || data.creator?.name,
    author_username: data.author_username || data.user?.username || data.creator?.username,
    author_avatar: data.author_avatar || data.user?.avatar_url || data.creator?.profile_image,
    likes_count: data.likes_count || data.like_count || data.digg_count,
    comments_count: data.comments_count || data.comment_count,
    shares_count: data.shares_count || data.share_count || data.retweet_count,
    views_count: data.views_count || data.view_count || data.play_count,
    created_at: data.created_at || data.posted_at,
    raw_data: data,
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

    const apiKey = Deno.env.get('OUTSTAND_API_KEY');
    if (!apiKey) {
      console.error('[fetch-universal-content] OUTSTAND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platform = detectPlatform(url);
    console.log(`[fetch-universal-content] Processing ${platform} URL: ${url}`);

    const content = await fetchFromOutstand(url, platform, apiKey);

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch content from platform' }),
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
