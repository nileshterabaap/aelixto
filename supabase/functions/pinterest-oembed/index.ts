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
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[pinterest-oembed] Fetching oEmbed data for URL:', url);

    // Validate it's a Pinterest pin URL
    if (!url.includes('pinterest.com/pin/')) {
      return new Response(
        JSON.stringify({ error: 'Not a valid Pinterest pin URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Pinterest oEmbed data
    const oembedUrl = `https://www.pinterest.com/oembed/?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error('[pinterest-oembed] Pinterest API error:', response.status);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch oEmbed data',
          title: 'Pinterest Pin',
          thumbnail_url: null,
          author_name: null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('[pinterest-oembed] Successfully fetched oEmbed data');

    return new Response(
      JSON.stringify({
        title: data.title || 'Pinterest Pin',
        thumbnail_url: data.thumbnail_url || null,
        author_name: data.author_name || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[pinterest-oembed] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        title: 'Pinterest Pin',
        thumbnail_url: null,
        author_name: null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
