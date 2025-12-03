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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting thumbnail refresh and permanent storage...');

    // Get posts with CDN thumbnails that need to be stored permanently
    // OR posts without any thumbnail that have a media_url
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('id, platform, media_url, thumbnail_url, title')
      .or('thumbnail_url.ilike.%cdninstagram.com%,thumbnail_url.ilike.%fbcdn.net%,thumbnail_url.ilike.%scontent%,thumbnail_url.is.null')
      .not('media_url', 'is', null)
      .limit(30);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${posts?.length || 0} posts to process`);

    let updated = 0;
    let failed = 0;

    for (const post of posts || []) {
      if (!post.media_url) continue;

      // Skip if already stored in our storage
      if (post.thumbnail_url?.includes('supabase.co/storage')) {
        console.log(`Post ${post.id} already has permanent thumbnail, skipping`);
        continue;
      }

      try {
        console.log(`Processing post ${post.id} (${post.platform})`);
        
        // First get fresh OG data
        const { data: ogData, error: ogError } = await supabase.functions.invoke('fetch-og', {
          body: { url: post.media_url }
        });

        if (ogError || !ogData?.image) {
          console.log(`No image found for post ${post.id}`);
          failed++;
          continue;
        }

        const imageUrl = ogData.image;
        console.log(`Got fresh image URL for post ${post.id}: ${imageUrl.substring(0, 60)}...`);

        // Now download and store the image permanently
        const imageResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!imageResponse.ok) {
          console.log(`Failed to fetch image for post ${post.id}: ${imageResponse.status}`);
          failed++;
          continue;
        }

        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        const imageData = await imageResponse.arrayBuffer();
        
        // Determine file extension
        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        else if (contentType.includes('gif')) ext = 'gif';

        const filePath = `thumbnails/${post.id}.${ext}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('post-thumbnails')
          .upload(filePath, imageData, {
            contentType: contentType.includes('heic') ? 'image/jpeg' : contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for post ${post.id}:`, uploadError);
          failed++;
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('post-thumbnails')
          .getPublicUrl(filePath);

        const permanentUrl = urlData.publicUrl;

        // Update post with permanent URL and title if available
        const updateData: Record<string, string> = { thumbnail_url: permanentUrl };
        if (ogData.title && (!post.title || post.title.includes('&#'))) {
          updateData.title = ogData.title;
        }

        const { error: updateError } = await supabase
          .from('posts')
          .update(updateData)
          .eq('id', post.id);

        if (updateError) {
          console.error(`DB update error for post ${post.id}:`, updateError);
          failed++;
        } else {
          console.log(`Successfully stored permanent thumbnail for post ${post.id}: ${permanentUrl}`);
          updated++;
        }
      } catch (err) {
        console.error(`Error processing post ${post.id}:`, err);
        failed++;
      }
    }

    console.log(`Refresh complete: ${updated} stored permanently, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: posts?.length || 0,
        updated,
        failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Refresh error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
