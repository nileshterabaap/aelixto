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
    const metaToken = Deno.env.get('META_APP_TOKEN');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[refresh-thumbnails] Starting thumbnail refresh with Meta oEmbed API...');

    // Get Instagram/Facebook posts that have CDN URLs (not Supabase storage)
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('id, platform, content, thumbnail_url, media_url')
      .in('platform', ['instagram', 'facebook'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      throw fetchError;
    }

    // Filter to only posts with CDN URLs (not already stored in Supabase)
    const postsNeedingRefresh = (posts || []).filter(p => 
      p.thumbnail_url && 
      !p.thumbnail_url.includes('supabase.co/storage') &&
      (p.thumbnail_url.includes('cdninstagram.com') || 
       p.thumbnail_url.includes('fbcdn.net') ||
       p.thumbnail_url.includes('scontent'))
    );

    console.log(`[refresh-thumbnails] Found ${posts?.length || 0} total posts, ${postsNeedingRefresh.length} need refresh`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const post of postsNeedingRefresh) {
      // Get URL from media_url first, then fall back to content
      let url = post.media_url;
      if (!url) {
        const urlMatch = post.content?.match(/https?:\/\/[^\s]+/);
        url = urlMatch?.[0];
      }
      
      if (!url) {
        console.log(`[refresh-thumbnails] No URL found in post ${post.id}`);
        failed++;
        continue;
      }

      let thumbnailUrl: string | null = null;

      try {
        // First, try to download and store the existing thumbnail_url if it's still valid
        if (post.thumbnail_url) {
          console.log(`[refresh-thumbnails] Trying to store existing CDN thumbnail for ${post.id}`);
          thumbnailUrl = await storeThumbnailPermanently(supabase, post.id, post.thumbnail_url);
        }
        
        // If that failed and we have Meta token, try oEmbed API as fallback
        if (!thumbnailUrl && metaToken) {
          if (post.platform === 'instagram') {
            const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${metaToken}`;
            const response = await fetch(oembedUrl);
            
            if (response.ok) {
              const data = await response.json();
              if (data.thumbnail_url) {
                thumbnailUrl = await storeThumbnailPermanently(supabase, post.id, data.thumbnail_url);
                console.log(`[refresh-thumbnails] Got Instagram thumbnail for ${post.id}`);
              }
            } else {
              const errorText = await response.text();
              console.log(`[refresh-thumbnails] Instagram oEmbed failed for ${post.id}: ${response.status} - ${errorText.substring(0, 100)}`);
            }
          } else if (post.platform === 'facebook') {
            const oembedUrl = `https://graph.facebook.com/v18.0/oembed_post?url=${encodeURIComponent(url)}&access_token=${metaToken}`;
            const response = await fetch(oembedUrl);
            
            if (response.ok) {
              const data = await response.json();
              if (data.thumbnail_url) {
                thumbnailUrl = await storeThumbnailPermanently(supabase, post.id, data.thumbnail_url);
              }
            }
          }
        }

        if (thumbnailUrl) {
          const { error: updateError } = await supabase
            .from('posts')
            .update({ thumbnail_url: thumbnailUrl })
            .eq('id', post.id);

          if (!updateError) {
            updated++;
            console.log(`[refresh-thumbnails] Updated post ${post.id} with stored thumbnail`);
          } else {
            failed++;
          }
        } else {
          failed++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`[refresh-thumbnails] Error processing post ${post.id}:`, error);
        failed++;
      }
    }

    console.log(`[refresh-thumbnails] Complete: ${updated} updated, ${failed} failed, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total: posts?.length || 0,
        updated,
        failed,
        skipped
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[refresh-thumbnails] Error:', error);
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

async function storeThumbnailPermanently(supabase: any, postId: string, imageUrl: string): Promise<string | null> {
  try {
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.log(`[refresh-thumbnails] Failed to download image: ${imageResponse.status}`);
      return null;
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageData = await imageResponse.arrayBuffer();
    
    // Validate image size
    if (imageData.byteLength < 1000) {
      console.log(`[refresh-thumbnails] Image too small (${imageData.byteLength} bytes) for ${postId}`);
      return null;
    }

    console.log(`[refresh-thumbnails] Downloaded ${imageData.byteLength} bytes for ${postId}`);

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
      console.error('[refresh-thumbnails] Upload error:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('post-thumbnails')
      .getPublicUrl(filePath);

    console.log(`[refresh-thumbnails] Stored: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[refresh-thumbnails] Store error:', error);
    return null;
  }
}