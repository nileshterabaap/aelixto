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

    console.log('Starting thumbnail backfill...');

    // Get posts without thumbnails
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('id, platform, media_url, media_type, thumbnail_url')
      .is('thumbnail_url', null)
      .limit(100); // Process in batches

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${posts?.length || 0} posts without thumbnails`);

    const extractYouTubeId = (url: string): string | null => {
      const match = url.match(
        /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]{11}).*/
      );
      return match?.[1] ?? null;
    };

    const updates: PromiseLike<any>[] = [];

    for (const post of posts || []) {
      let thumbnailUrl: string | null = null;

      // 1) YouTube - use maxresdefault
      if (post.platform === 'youtube' && post.media_url) {
        const videoId = extractYouTubeId(post.media_url);
        if (videoId) {
          thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
      }
      
      // 2) Image type - use media_url directly
      else if (post.media_type === 'image' && post.media_url) {
        thumbnailUrl = post.media_url;
      }
      
      // 3) For social platforms, try fetching OG data
      else if (post.media_url && (
        post.platform === 'instagram' ||
        post.platform === 'reddit' ||
        post.platform === 'twitter' ||
        post.platform === 'x' ||
        post.platform === 'facebook' ||
        post.platform === 'quora' ||
        post.platform === 'medium'
      )) {
        try {
          const { data: ogData } = await supabase.functions.invoke('fetch-og', {
            body: { url: post.media_url }
          });
          
          if (ogData?.image) {
            thumbnailUrl = ogData.image;
          }
        } catch (err) {
          console.log(`Failed to fetch OG for post ${post.id}:`, err);
        }
      }

      // Update if we found a thumbnail
      if (thumbnailUrl) {
        console.log(`Updating post ${post.id} with thumbnail: ${thumbnailUrl}`);
        const updatePromise = supabase
          .from('posts')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', post.id)
          .select()
          .then();
        updates.push(updatePromise);
      }
    }

    // Execute all updates
    const results = await Promise.allSettled(updates);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Backfill complete: ${successful} updated, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: posts?.length || 0,
        updated: successful,
        failed: failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backfill error:', error);
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
