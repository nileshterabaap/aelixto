const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Get META_APP_TOKEN from environment
    const metaAppToken = Deno.env.get('META_APP_TOKEN');
    
    if (!metaAppToken) {
      console.error('[ig-oembed-json] META_APP_TOKEN not configured');
      return new Response(
        JSON.stringify({ 
          error: 'META_APP_TOKEN not configured. Please add it in Lovable Cloud secrets (format: APP_ID|APP_SECRET)' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ig-oembed-json] Fetching oEmbed for:', url);

    // Call Instagram oEmbed API
    const encodedUrl = encodeURIComponent(url);
    const oembedUrl = `https://graph.facebook.com/v19.0/instagram_oembed?omitscript=true&url=${encodedUrl}&access_token=${metaAppToken}`;
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ig-oembed-json] Facebook API error:', response.status, errorText);
      
      // Check if it's an auth error
      if (response.status === 400 || response.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid META_APP_TOKEN. Please verify your App ID and App Secret are correct (format: APP_ID|APP_SECRET)',
            details: errorText
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Instagram oEmbed data', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Return only safe fields
    const safeData = {
      author_name: data.author_name || '',
      author_url: data.author_url || '',
      thumbnail_url: data.thumbnail_url || '',
      title: data.title || '',
      provider_url: data.provider_url || 'https://www.instagram.com',
      url: url, // Original URL
    };

    console.log('[ig-oembed-json] Successfully fetched oEmbed data');

    return new Response(
      JSON.stringify(safeData),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // 5 minute cache
        } 
      }
    );

  } catch (error) {
    console.error('[ig-oembed-json] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
