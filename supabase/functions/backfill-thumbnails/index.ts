import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check if a thumbnail URL is a temporary CDN URL that will expire
function isExpiredCdnUrl(url: string | null): boolean {
  if (!url) return false;
  // Instagram/Facebook CDN URLs contain these patterns and expire
  return url.includes('cdninstagram.com') || 
         url.includes('fbcdn.net') ||
         url.includes('scontent');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting thumbnail backfill...');

    // Get posts that either have no thumbnail OR have expired CDN URLs
    const { data: allPosts, error: fetchError } = await supabase
      .from('posts')
      .select('id, platform, media_url, media_type, thumbnail_url, title')
      .in('platform', ['instagram', 'facebook'])
      .limit(100);
    
    // Filter to posts needing thumbnail refresh
    const posts = (allPosts || []).filter(p => 
      !p.thumbnail_url || isExpiredCdnUrl(p.thumbnail_url)
    );

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
      let titleToSave: string | null = post.title;

      // 1) YouTube - use maxresdefault
      if (post.platform === 'youtube' && post.media_url) {
        const videoId = extractYouTubeId(post.media_url);
        if (videoId) {
          thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
      }
      
      // Instagram/Facebook - use fetch-meta-thumbnail for permanent storage
      else if (post.media_url && (post.platform === 'instagram' || post.platform === 'facebook')) {
        try {
          console.log(`Calling fetch-meta-thumbnail for ${post.platform} post ${post.id}`);
          const { data: metaData, error: metaError } = await supabase.functions.invoke('fetch-meta-thumbnail', {
            body: { url: post.media_url, platform: post.platform }
          });
          
          if (metaError) {
            console.log(`fetch-meta-thumbnail error for post ${post.id}:`, metaError);
          } else if (metaData?.thumbnail) {
            // Only use if it's a permanent Supabase URL
            if (metaData.thumbnail.includes('supabase') || !isExpiredCdnUrl(metaData.thumbnail)) {
              thumbnailUrl = metaData.thumbnail;
              console.log(`Got permanent thumbnail for post ${post.id}: ${metaData.thumbnail.substring(0, 60)}...`);
            }
          }
          if (metaData?.title && !post.title) {
            titleToSave = metaData.title;
          }
        } catch (err) {
          console.log(`Failed to fetch meta thumbnail for post ${post.id}:`, err);
        }
      }
      
      // Other social platforms - use fetch-og
      else if (post.media_url && (
        post.platform === 'reddit' ||
        post.platform === 'twitter' ||
        post.platform === 'x' ||
        post.platform === 'quora' ||
        post.platform === 'medium' ||
        post.platform === 'linkedin' ||
        post.platform === 'spotify' ||
        post.platform === 'blog' ||
        (!post.platform && post.media_type === 'none')
      )) {
        try {
          const { data: ogData } = await supabase.functions.invoke('fetch-og', {
            body: { url: post.media_url }
          });
          
          if (ogData?.image) {
            thumbnailUrl = ogData.image;
          }
          if (ogData?.title && !post.title) {
            titleToSave = ogData.title;
          }
        } catch (err) {
          console.log(`Failed to fetch OG for post ${post.id}:`, err);
        }
      }

      // Update if we found a thumbnail or title
      if (thumbnailUrl || (titleToSave && titleToSave !== post.title)) {
        console.log(`Updating post ${post.id} with thumbnail: ${thumbnailUrl}, title: ${titleToSave}`);
        const updateData: any = {};
        if (thumbnailUrl) updateData.thumbnail_url = thumbnailUrl;
        if (titleToSave && titleToSave !== post.title) updateData.title = titleToSave;
        
        const updatePromise = supabase
          .from('posts')
          .update(updateData)
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
