const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[unfurl-url] Fetching:', url);

    // Follow redirects with HEAD first, then GET
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log('[unfurl-url] Response not OK:', response.status);
        return new Response(
          JSON.stringify({}),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const html = await response.text();
      const finalUrl = response.url;

      // Extract OG tags and other metadata
      const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1];
      const ogDescription = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1];
      const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
      const ogSiteName = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i)?.[1];
      
      // Fallback to regular meta tags
      const title = ogTitle || html.match(/<title>([^<]+)<\/title>/i)?.[1];
      const description = ogDescription || html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1];
      
      // Extract favicon
      const faviconRelative = html.match(/<link\s+rel=["'](icon|shortcut icon)["']\s+href=["']([^"']+)["']/i)?.[2];
      const favicon = faviconRelative ? new URL(faviconRelative, finalUrl).href : undefined;
      
      // Extract canonical URL
      const canonicalRelative = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
      const canonicalUrl = canonicalRelative ? new URL(canonicalRelative, finalUrl).href : finalUrl;
      
      // Absolutize image URL
      const absoluteImage = ogImage ? new URL(ogImage, finalUrl).href : undefined;

      const result = {
        title: title?.trim(),
        description: description?.trim(),
        image: absoluteImage,
        siteName: ogSiteName?.trim(),
        favicon,
        canonicalUrl,
      };

      console.log('[unfurl-url] Result:', result);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('[unfurl-url] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({}),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[unfurl-url] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
