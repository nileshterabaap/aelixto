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

    console.log('[fetch-og] Fetching OG data for:', targetUrl);

    // Fetch the HTML with better headers to avoid 403 blocks
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      // If blocked (403/401), return platform-specific placeholders
      if (response.status === 403 || response.status === 401) {
        console.log('[fetch-og] Blocked by site, returning platform placeholder');
        
        const urlLower = targetUrl.toLowerCase();
        let platformName = 'Web';
        let placeholderImage = 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=1200&h=630&fit=crop';
        
        if (urlLower.includes('quora.com')) {
          platformName = 'Quora';
          placeholderImage = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200&h=630&fit=crop';
        } else if (urlLower.includes('reddit.com')) {
          platformName = 'Reddit';
          placeholderImage = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&h=630&fit=crop';
        } else if (urlLower.includes('medium.com')) {
          platformName = 'Medium';
          placeholderImage = 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&h=630&fit=crop';
        }
        
        return new Response(
          JSON.stringify({ 
            title: `${platformName} Post`,
            image: placeholderImage,
            description: `View this post on ${platformName}`,
            finalUrl: targetUrl
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const finalUrl = response.url;

    // Extract Open Graph metadata with multiple fallbacks
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const titleFallback = titleMatch ? null : html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
    const titleFallback2 = (titleMatch || titleFallback) ? null : html.match(/<title[^>]*>([^<]+)<\/title>/i);
    
    const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const imageFallback = imageMatch ? null : html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
    const imageFallback2 = (imageMatch || imageFallback) ? null : html.match(/<meta\s+property=["']og:image:url["']\s+content=["']([^"']+)["']/i);
    
    const descriptionMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    const descriptionFallback = descriptionMatch ? null : html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const descriptionFallback2 = (descriptionMatch || descriptionFallback) ? null : html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i);
    
    const title = titleMatch ? titleMatch[1] : (titleFallback ? titleFallback[1] : (titleFallback2 ? titleFallback2[1] : null));
    const image = imageMatch ? imageMatch[1] : (imageFallback ? imageFallback[1] : (imageFallback2 ? imageFallback2[1] : null));
    const description = descriptionMatch ? descriptionMatch[1] : (descriptionFallback ? descriptionFallback[1] : (descriptionFallback2 ? descriptionFallback2[1] : null));

    // Check if Facebook post is unavailable (redirects to login or missing content)
    const isFacebookLogin = finalUrl.includes('facebook.com/login') || 
                            (title && title.includes('Log in to Facebook') && !image);

    console.log('[fetch-og] Extracted OG data:', { title, image, description, finalUrl, isFacebookLogin });

    return new Response(
      JSON.stringify({ 
        title, 
        image, 
        description, 
        finalUrl,
        unavailable: isFacebookLogin
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fetch-og] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Open Graph data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
