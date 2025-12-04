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
    const { postId, imageUrl } = await req.json();
    
    if (!postId || !imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing postId or imageUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[store-thumbnail] Downloading image for post ${postId}: ${imageUrl.substring(0, 80)}...`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.error(`[store-thumbnail] Failed to fetch image: ${imageResponse.status}`);
      return new Response(
        JSON.stringify({ error: `Failed to fetch image: ${imageResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageData = await imageResponse.arrayBuffer();
    
    // Determine file extension
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';
    else if (contentType.includes('heic')) ext = 'jpg'; // Convert heic to jpg path

    const filePath = `thumbnails/${postId}.${ext}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('post-thumbnails')
      .upload(filePath, imageData, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[store-thumbnail] Upload error:`, uploadError);
      return new Response(
        JSON.stringify({ error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('post-thumbnails')
      .getPublicUrl(filePath);

    const permanentUrl = urlData.publicUrl;

    // Update post with permanent URL
    const { error: updateError } = await supabase
      .from('posts')
      .update({ thumbnail_url: permanentUrl })
      .eq('id', postId);

    if (updateError) {
      console.error(`[store-thumbnail] DB update error:`, updateError);
    }

    console.log(`[store-thumbnail] Successfully stored thumbnail for post ${postId}: ${permanentUrl}`);

    return new Response(
      JSON.stringify({ success: true, url: permanentUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[store-thumbnail] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
