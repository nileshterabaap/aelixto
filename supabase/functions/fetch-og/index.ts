import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url: targetUrl } = await req.json();

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fetch-og] Fetching metadata for:', targetUrl);

    // Fetch the page HTML
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AelixtoBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    const finalUrl = response.url;

    // Extract OpenGraph metadata
    const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i)?.[1] || '';
    const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i)?.[1] || '';
    const ogDescription = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i)?.[1] || '';
    
    // Fallback to regular meta tags
    const title = ogTitle || html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
    const image = ogImage || html.match(/<meta\s+name="twitter:image"\s+content="([^"]*)"/i)?.[1] || '';

    console.log('[fetch-og] Extracted metadata:', { title, image, finalUrl });

    return new Response(
      JSON.stringify({ 
        title: title.trim(),
        image: image.trim(),
        description: ogDescription.trim(),
        finalUrl 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fetch-og] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch metadata' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
