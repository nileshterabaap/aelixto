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

    // YouTube special handling
    if (platform === 'youtube') {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }
    // Reddit special handling
    else if (platform === 'reddit') {
      thumbnailUrl = await fetchRedditThumbnail(url);
    }
    // Instagram/Facebook - try OG scrape
    else if (platform === 'instagram' || platform === 'facebook') {
      const ogData = await scrapeOgData(url);
      thumbnailUrl = ogData.image;
      previewText = ogData.description;
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
      console.log(`[fetch-post-preview] Updated post ${postId} with thumbnail`);
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

async function fetchRedditThumbnail(url: string): Promise<string | null> {
  try {
    // Try JSON endpoint
    const jsonUrl = url.replace(/\/$/, '') + '.json';
    const res = await fetch(jsonUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    
    if (res.ok) {
      const json = await res.json();
      const post = json[0]?.data?.children?.[0]?.data;
      return post?.thumbnail?.startsWith('http') ? post.thumbnail : null;
    }
  } catch (e) {
    console.log('[fetch-post-preview] Reddit JSON fetch failed, trying OG scrape');
  }
  
  const ogData = await scrapeOgData(url);
  return ogData.image;
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
      console.log(`[fetch-post-preview] Fetch failed with status ${response.status}`);
      return { image: null, title: null, description: null };
    }

    const html = await response.text();

    // Extract OG image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    
    const image = ogImageMatch?.[1] || twitterImageMatch?.[1] || null;

    // Extract OG title
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    const title = ogTitleMatch?.[1] || null;

    // Extract OG description
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = ogDescMatch?.[1] || null;

    return { image, title, description };
  } catch (error) {
    console.error('[fetch-post-preview] Scraping error:', error);
    return { image: null, title: null, description: null };
  }
}
