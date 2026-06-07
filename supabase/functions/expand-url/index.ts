import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SSRF Protection: Validate URLs to prevent internal network access
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      console.log('[expand-url] Rejected non-HTTP protocol:', parsed.protocol);
      return false;
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost and common internal hostnames
    const blockedHostnames = [
      'localhost', 
      'metadata.google.internal',
      'metadata.google',
      '169.254.169.254',
      'instance-data',
    ];
    
    if (blockedHostnames.includes(hostname)) {
      console.log('[expand-url] Rejected blocked hostname:', hostname);
      return false;
    }
    
    // Block private IP ranges
    const privateIpPatterns = [
      /^127\./, // Loopback
      /^10\./, // Class A private
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
      /^192\.168\./, // Class C private
      /^169\.254\./, // Link-local
      /^0\./, // Current network
      /^::1$/, // IPv6 loopback
      /^fc00:/, // IPv6 unique local
      /^fe80:/, // IPv6 link-local
      /^fd/, // IPv6 private
    ];
    
    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        console.log('[expand-url] Rejected private IP:', hostname);
        return false;
      }
    }
    
    return true;
  } catch {
    console.log('[expand-url] Failed to parse URL');
    return false;
  }
}

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

    // SSRF Protection: Validate URL before fetching
    if (!isValidExternalUrl(targetUrl)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or blocked URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[expand-url] Expanding URL:', targetUrl);

    const parsedTarget = new URL(targetUrl);
    const redditShareFallback =
      /^www\.reddit\.com$/i.test(parsedTarget.hostname) &&
      /^\/r\/[^/]+\/s\/[^/]+\/?$/i.test(parsedTarget.pathname)
        ? `https://reddit.com${parsedTarget.pathname}${parsedTarget.search}`
        : targetUrl;

    // Some platforms, especially Reddit mobile /s/ shares, block HEAD or
    // www-prefixed short links. Use a real browser-like GET and, for Reddit,
    // prefer reddit.com so the first public redirect exposes the canonical
    // /comments/ URL before Reddit's bot protection page appears.
    const isRedditShareFallback = redditShareFallback !== targetUrl;
    const response = await fetch(redditShareFallback, {
      method: 'GET',
      redirect: isRedditShareFallback ? 'manual' : 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const redirectLocation = response.headers.get('location');
    const finalUrl = redirectLocation && /^https?:\/\//i.test(redirectLocation)
      ? redirectLocation
      : response.url;
    console.log('[expand-url] Final URL:', finalUrl);

    return new Response(
      JSON.stringify({ finalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[expand-url] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to expand URL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
