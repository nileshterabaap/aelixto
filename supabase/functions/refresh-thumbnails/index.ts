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

    console.log('Starting thumbnail refresh for CDN URLs...');

    // Get posts with Instagram/Facebook CDN URLs that likely expired
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('id, platform, media_url, thumbnail_url, title')
      .or('thumbnail_url.ilike.%cdninstagram.com%,thumbnail_url.ilike.%fbcdn.net%,thumbnail_url.ilike.%scontent%')
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${posts?.length || 0} posts with CDN thumbnails to refresh`);

    let updated = 0;
    let failed = 0;

    for (const post of posts || []) {
      if (!post.media_url) continue;

      try {
        console.log(`Refreshing thumbnail for post ${post.id} (${post.platform}): ${post.media_url}`);
        
        // Call fetch-og to get fresh thumbnail
        const { data: ogData, error: ogError } = await supabase.functions.invoke('fetch-og', {
          body: { url: post.media_url }
        });

        if (ogError) {
          console.log(`OG fetch error for post ${post.id}:`, ogError);
          failed++;
          continue;
        }

        if (ogData?.image) {
          console.log(`Got fresh thumbnail for post ${post.id}: ${ogData.image.substring(0, 80)}...`);
          
          const updateData: Record<string, string> = { 
            thumbnail_url: ogData.image 
          };
          
          // Also update title if we got one and it's better
          if (ogData.title && (!post.title || post.title.includes('&#'))) {
            updateData.title = ogData.title;
          }

          const { error: updateError } = await supabase
            .from('posts')
            .update(updateData)
            .eq('id', post.id);

          if (updateError) {
            console.log(`Update error for post ${post.id}:`, updateError);
            failed++;
          } else {
            console.log(`Successfully updated post ${post.id}`);
            updated++;
          }
        } else {
          console.log(`No image found for post ${post.id}`);
          failed++;
        }
      } catch (err) {
        console.log(`Error processing post ${post.id}:`, err);
        failed++;
      }
    }

    console.log(`Refresh complete: ${updated} updated, ${failed} failed`);

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
