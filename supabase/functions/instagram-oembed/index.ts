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
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate that it's an Instagram URL
    if (!url.includes('instagram.com')) {
      return new Response(
        JSON.stringify({ error: 'Invalid Instagram URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metaToken = Deno.env.get('META_APP_TOKEN');
    if (!metaToken) {
      console.error('META_APP_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Instagram oEmbed data for:', url);

    // Call Meta's Graph API oEmbed endpoint
    const oembedUrl = `https://graph.facebook.com/v17.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${metaToken}`;
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Instagram oEmbed API error:', response.status, errorText);
      
      // Return a fallback response instead of throwing
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch Instagram data',
          thumbnail_url: '',
          title: '',
          author_name: ''
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Instagram oEmbed data fetched successfully:', data);

    return new Response(
      JSON.stringify({
        thumbnail_url: data.thumbnail_url || '',
        title: data.title || '',
        author_name: data.author_name || '',
        url: url
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in instagram-oembed function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        thumbnail_url: '',
        title: '',
        author_name: ''
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
