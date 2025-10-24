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
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[pin-preview] Processing URL:', url);

    let finalUrl = url;

    // Expand pin.it short links
    if (url.includes('pin.it/')) {
      console.log('[pin-preview] Expanding short link...');
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
      });
      finalUrl = response.url;
      console.log('[pin-preview] Expanded to:', finalUrl);
    }

    // Validate Pinterest pin URL
    if (!finalUrl.includes('pinterest.com/pin/')) {
      return new Response(
        JSON.stringify({ error: 'Not a valid Pinterest pin URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the page HTML
    console.log('[pin-preview] Fetching page HTML...');
    const pageResponse = await fetch(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!pageResponse.ok) {
      console.error('[pin-preview] Failed to fetch page:', pageResponse.status);
      return new Response(
        JSON.stringify({ 
          finalUrl,
          title: 'Pinterest Pin',
          imageUrl: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await pageResponse.text();

    // Extract Open Graph tags
    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    const ogImageMatch = html.match(/<meta\s+property="og:image(?::secure_url)?"\s+content="([^"]+)"/i);

    const title = ogTitleMatch ? ogTitleMatch[1] : 'Pinterest Pin';
    const imageUrl = ogImageMatch ? ogImageMatch[1] : null;

    console.log('[pin-preview] Extracted:', { title, imageUrl: imageUrl ? 'found' : 'missing' });

    return new Response(
      JSON.stringify({
        finalUrl,
        title,
        imageUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[pin-preview] Error:', error);
    const { url: fallbackUrl } = await req.json().catch(() => ({ url: '' }));
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        finalUrl: fallbackUrl,
        title: 'Pinterest Pin',
        imageUrl: null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
