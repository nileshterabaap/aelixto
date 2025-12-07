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

    // Get Instagram/Facebook posts
    const { data: posts, error: fetchError } = await supabase
      .from('posts')
      .select('id, platform, content, thumbnail_url')
      .in('platform', ['instagram', 'facebook'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`[refresh-thumbnails] Found ${posts?.length || 0} posts to process`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const post of posts || []) {
      // Force re-download all Instagram/Facebook thumbnails since existing ones may be corrupted

      // Extract URL from post content
      const urlMatch = post.content.match(/https?:\/\/[^\s]+/);
      if (!urlMatch) {
        console.log(`[refresh-thumbnails] No URL found in post ${post.id}`);
        failed++;
        continue;
      }

      const url = urlMatch[0];
      let thumbnailUrl: string | null = null;

      try {
        if (post.platform === 'instagram' && metaToken) {
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
        } else if (post.platform === 'facebook' && metaToken) {
          const oembedUrl = `https://graph.facebook.com/v18.0/oembed_post?url=${encodeURIComponent(url)}&access_token=${metaToken}`;
          const response = await fetch(oembedUrl);
          
          if (response.ok) {
            const data = await response.json();
            if (data.thumbnail_url) {
              thumbnailUrl = await storeThumbnailPermanently(supabase, post.id, data.thumbnail_url);
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
            console.log(`[refresh-thumbnails] Updated post ${post.id} with thumbnail`);
          } else {
            failed++;
          }
        } else {
          failed++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

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