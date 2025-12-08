import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, platform } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'Missing URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-meta-thumbnail] Fetching for ${platform}: ${url}`);

    const metaToken = Deno.env.get('META_APP_TOKEN');
    
    let thumbnail = '';
    let title = '';

    if (platform === 'instagram' || platform === 'facebook') {
      if (!metaToken) {
        console.error('[fetch-meta-thumbnail] META_APP_TOKEN not configured');
        return new Response(
          JSON.stringify({ error: 'META_APP_TOKEN not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use Meta Graph API oEmbed endpoint
      const oembedUrl = `https://graph.facebook.com/v18.0/oembed_${platform === 'instagram' ? 'post' : 'page'}?url=${encodeURIComponent(url)}&access_token=${metaToken}`;
      
      console.log(`[fetch-meta-thumbnail] Calling Meta oEmbed API`);
      
      const response = await fetch(oembedUrl);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[fetch-meta-thumbnail] Meta response:`, JSON.stringify(data).substring(0, 200));
        thumbnail = data.thumbnail_url || '';
        title = data.title || '';
      } else {
        const errorText = await response.text();
        console.error(`[fetch-meta-thumbnail] Meta API error: ${response.status} - ${errorText}`);
        
        // Fallback for Instagram - try public oEmbed
        if (platform === 'instagram') {
          try {
            const publicResponse = await fetch(`https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`);
            if (publicResponse.ok) {
              const publicData = await publicResponse.json();
              thumbnail = publicData.thumbnail_url || '';
              title = publicData.title || '';
              console.log(`[fetch-meta-thumbnail] Instagram public oEmbed worked:`, thumbnail.substring(0, 80));
            }
          } catch (e) {
            console.error(`[fetch-meta-thumbnail] Instagram public oEmbed failed:`, e);
          }
        }
      }
    } else if (platform === 'twitter') {
      // Twitter/X - use publish.twitter.com oEmbed
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
      
      console.log(`[fetch-meta-thumbnail] Calling Twitter oEmbed API`);
      
      const response = await fetch(oembedUrl);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[fetch-meta-thumbnail] Twitter response received`);
        
        // Twitter oEmbed returns HTML, extract image from it
        const html = data.html || '';
        
        // Try to extract profile image or media from the embed HTML
        const imgMatch = html.match(/https:\/\/pbs\.twimg\.com\/[^"'\s]+/);
        if (imgMatch) {
          thumbnail = imgMatch[0];
        }
        
        // Get author name as title
        title = data.author_name || '';
      } else {
        console.error(`[fetch-meta-thumbnail] Twitter API error: ${response.status}`);
      }
    }

    console.log(`[fetch-meta-thumbnail] Result - thumbnail: ${thumbnail ? thumbnail.substring(0, 60) + '...' : 'none'}, title: ${title}`);

    return new Response(
      JSON.stringify({ thumbnail, title }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fetch-meta-thumbnail] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
