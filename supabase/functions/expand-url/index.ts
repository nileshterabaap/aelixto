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

async function resolveRedditAppShareUrl(parsedTarget: URL): Promise<string | null> {
  const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa('6N9uN0krSDE-ig:')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Aelixto/1.0',
    },
    body: new URLSearchParams({
      grant_type: 'https://oauth.reddit.com/grants/installed_client',
      device_id: 'DO_NOT_TRACK_THIS_DEVICE',
    }),
  });

  if (!tokenResponse.ok) return null;
  const tokenData = await tokenResponse.json();
  const accessToken = typeof tokenData?.access_token === 'string' ? tokenData.access_token : null;
  if (!accessToken) return null;

  const response = await fetch(`https://oauth.reddit.com${parsedTarget.pathname}${parsedTarget.search}`, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'Aelixto/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  const location = response.headers.get('location');
  if (location && /\/comments\/[a-z0-9_]+/i.test(location)) {
    return location.replace(/&amp;/g, '&');
  }

  const body = await response.text();
  const bodyRedirect = body.match(/https:\/\/www\.reddit\.com\/(?:r|user)\/[^"'<>\s]+\/comments\/[a-z0-9_]+[^"'<>\s]*/i)?.[0];
  return bodyRedirect ? bodyRedirect.replace(/&amp;/g, '&') : null;
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
    const isRedditShortShare =
      /^(?:www\.)?reddit\.com$/i.test(parsedTarget.hostname) &&
      /^\/(?:r|user)\/[^/]+\/s\/[^/]+\/?$/i.test(parsedTarget.pathname);
    if (isRedditShortShare) {
      const redditFinalUrl = await resolveRedditAppShareUrl(parsedTarget);
      if (redditFinalUrl) {
        console.log('[expand-url] Final URL:', redditFinalUrl);
        return new Response(
          JSON.stringify({ finalUrl: redditFinalUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const redirectLocation = response.headers.get('location');
    let finalUrl = redirectLocation && /^https?:\/\//i.test(redirectLocation)
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
