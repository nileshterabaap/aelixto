import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check if a thumbnail URL is a temporary CDN URL that will expire
function isExpiredCdnUrl(url: string | null): boolean {
  if (!url) return true; // Missing = needs fetch
  // Already permanent (our storage)
  if (url.includes('supabase.co/storage') || url.includes('post-thumbnails')) {
    return false;
  }
  // Instagram/Facebook CDN URLs contain these patterns and expire
  return url.includes('cdninstagram.com') || 
         url.includes('fbcdn.net') ||
         url.includes('scontent');
}

// Store thumbnail permanently in Supabase storage
async function storeThumbnailPermanently(supabase: any, postId: string, imageUrl: string): Promise<string | null> {
  try {
    console.log(`[backfill] Downloading: ${imageUrl.substring(0, 80)}...`);
    
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!imageResponse.ok) {
      console.log(`[backfill] Download failed: ${imageResponse.status}`);
      return null;
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageData = await imageResponse.arrayBuffer();
    
    // Validate image size
    if (imageData.byteLength < 1000) {
      console.log(`[backfill] Image too small (${imageData.byteLength} bytes)`);
      return null;
    }

    console.log(`[backfill] Downloaded ${imageData.byteLength} bytes`);

    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';

    const filePath = `thumbnails/${postId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('post-thumbnails')
      .upload(filePath, imageData, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[backfill] Upload error:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('post-thumbnails')
      .getPublicUrl(filePath);

    console.log(`[backfill] Stored: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[backfill] Store error:', error);
    return null;
  }
}

// Fetch fresh thumbnail via OG scraping
async function fetchFreshThumbnail(supabase: any, url: string): Promise<{ thumbnail: string | null; title: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('fetch-og', {
      body: { url }
    });
    
    if (error) {
      console.log(`[backfill] fetch-og error:`, error);
      return { thumbnail: null, title: null };
    }
    
    return { 
      thumbnail: data?.image || null, 
      title: data?.title || null 
    };
  } catch (err) {
    console.log(`[backfill] fetch-og exception:`, err);
    return { thumbnail: null, title: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[backfill] Starting thumbnail backfill...');

    // Get Instagram/Facebook posts that need thumbnail refresh
    const { data: allPosts, error: fetchError } = await supabase
      .from('posts')
      .select('id, platform, media_url, media_type, thumbnail_url, title')
      .in('platform', ['instagram', 'facebook'])
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (fetchError) {
      throw fetchError;
    }

    // Filter to posts needing thumbnail refresh (missing or expiring CDN URLs)
    const posts = (allPosts || []).filter(p => isExpiredCdnUrl(p.thumbnail_url));

    console.log(`[backfill] Found ${allPosts?.length || 0} total posts, ${posts.length} need refresh`);

    let updated = 0;
    let failed = 0;

    for (const post of posts) {
      const url = post.media_url;
      
      if (!url) {
        console.log(`[backfill] No URL for post ${post.id}`);
        failed++;
        continue;
      }

      try {
        // Step 1: Get fresh thumbnail via OG scraping
        console.log(`[backfill] Fetching fresh OG for ${post.id}: ${url.substring(0, 50)}...`);
        const { thumbnail: freshThumb, title: freshTitle } = await fetchFreshThumbnail(supabase, url);
        
        if (!freshThumb) {
          console.log(`[backfill] No thumbnail from OG for ${post.id}`);
          failed++;
          continue;
        }
        
        // Step 2: Download and store permanently
        const permanentUrl = await storeThumbnailPermanently(supabase, post.id, freshThumb);
        
        if (!permanentUrl) {
          console.log(`[backfill] Failed to store thumbnail for ${post.id}`);
          failed++;
          continue;
        }
        
        // Step 3: Update database
        const updateData: Record<string, string> = { thumbnail_url: permanentUrl };
        if (freshTitle && !post.title) {
          updateData.title = freshTitle;
        }
        
        const { error: updateError } = await supabase
          .from('posts')
          .update(updateData)
          .eq('id', post.id);

        if (updateError) {
          console.error(`[backfill] DB update error for ${post.id}:`, updateError);
          failed++;
        } else {
          updated++;
          console.log(`[backfill] ✓ Updated post ${post.id}`);
        }

        // Rate limiting - 500ms between posts
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`[backfill] Error processing post ${post.id}:`, error);
        failed++;
      }
    }

    console.log(`[backfill] Complete: ${updated} updated, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: posts.length,
        updated,
        failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[backfill] Error:', error);
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
