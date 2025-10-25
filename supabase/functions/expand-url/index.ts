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

    console.log('[expand-url] Expanding URL:', targetUrl);

    // Fetch with redirect following
    const response = await fetch(targetUrl, {
      method: 'HEAD',
      redirect: 'follow',
    });

    const finalUrl = response.url;
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
