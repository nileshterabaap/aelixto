import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get('u');
    const width = parseInt(url.searchParams.get('w') || '480', 10);

    if (!imageUrl) {
      return new Response('Missing image URL parameter "u"', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Validate HTTPS only
    if (!imageUrl.startsWith('https://')) {
      return new Response('Only HTTPS URLs are allowed', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log(`[img-proxy] Fetching: ${imageUrl}`);

    // Fetch the image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.error(`[img-proxy] Failed to fetch image: ${imageResponse.status}`);
      return new Response('Failed to fetch image', { 
        status: imageResponse.status,
        headers: corsHeaders 
      });
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageData = await imageResponse.arrayBuffer();

    // Return with aggressive caching headers
    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable', // 7 days
        'CDN-Cache-Control': 'public, max-age=604800',
      },
    });
  } catch (error) {
    console.error('[img-proxy] Error:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
