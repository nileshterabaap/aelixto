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

    // Fetch the HTML
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AelixtoBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const finalUrl = response.url;

    // Extract Open Graph metadata
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const descriptionMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    
    // Fallback to standard meta tags if OG tags not found
    const descriptionFallback = descriptionMatch ? null : html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    
    const title = titleMatch ? titleMatch[1] : null;
    const image = imageMatch ? imageMatch[1] : null;
    const description = descriptionMatch ? descriptionMatch[1] : (descriptionFallback ? descriptionFallback[1] : null);

    console.log('[fetch-og] Extracted OG data:', { title, image, description, finalUrl });

    return new Response(
      JSON.stringify({ title, image, description, finalUrl }),
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
