import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SSRF Protection: Validate URLs to prevent internal network access
function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      console.log('[fetch-meta-thumbnail] Rejected non-HTTP protocol:', parsed.protocol);
      return false;
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost and common internal hostnames
    const blockedHostnames = [
      'localhost', 
      'metadata.google.internal',
      'metadata.google',
      '169.254.169.254',
      'instance-data',
    ];
    
    if (blockedHostnames.includes(hostname)) {
      console.log('[fetch-meta-thumbnail] Rejected blocked hostname:', hostname);
      return false;
    }
    
    // Block private IP ranges
    const privateIpPatterns = [
      /^127\./, // Loopback
      /^10\./, // Class A private
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
      /^192\.168\./, // Class C private
      /^169\.254\./, // Link-local
      /^0\./, // Current network
      /^::1$/, // IPv6 loopback
      /^fc00:/, // IPv6 unique local
      /^fe80:/, // IPv6 link-local
      /^fd/, // IPv6 private
    ];
    
    for (const pattern of privateIpPatterns) {
      if (pattern.test(hostname)) {
        console.log('[fetch-meta-thumbnail] Rejected private IP:', hostname);
        return false;
      }
    }
    
    return true;
  } catch {
    console.log('[fetch-meta-thumbnail] Failed to parse URL');
    return false;
  }
}

// Store thumbnail permanently in Supabase storage to avoid CDN expiration
async function storeThumbnailPermanently(imageUrl: string): Promise<string | null> {
  try {
    // Generate a unique ID for this thumbnail
    const thumbnailId = crypto.randomUUID();
    
    console.log(`[fetch-meta-thumbnail] Downloading and storing thumbnail: ${imageUrl.substring(0, 60)}...`);
    
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.error(`[fetch-meta-thumbnail] Failed to download image: ${imageResponse.status}`);
      return null;
    }

    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const imageData = await imageResponse.arrayBuffer();
    
    // Check if we got actual image data
    if (imageData.byteLength < 1000) {
      console.error(`[fetch-meta-thumbnail] Image too small (${imageData.byteLength} bytes), likely empty`);
      return null;
    }

    // Determine file extension
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('heic')) ext = 'jpg'; // Convert HEIC to jpg extension

    const filePath = `thumbnails/${thumbnailId}.${ext}`;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('post-thumbnails')
      .upload(filePath, imageData, {
        contentType: contentType.includes('heic') ? 'image/jpeg' : contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[fetch-meta-thumbnail] Storage upload error:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('post-thumbnails')
      .getPublicUrl(filePath);

    console.log(`[fetch-meta-thumbnail] Stored thumbnail permanently: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[fetch-meta-thumbnail] Store thumbnail error:', error);
    return null;
  }
}

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

    // SSRF Protection: Validate URL before fetching
    if (!isValidExternalUrl(url)) {
      return new Response(
        JSON.stringify({ error: 'Invalid or blocked URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-meta-thumbnail] Fetching for ${platform}: ${url}`);

    const metaToken = Deno.env.get('META_APP_TOKEN');
    
    let thumbnail = '';
    let title = '';
    let description = ''; // Instagram caption / post text

    if (platform === 'instagram' || platform === 'facebook') {
      if (!metaToken) {
        console.error('[fetch-meta-thumbnail] META_APP_TOKEN not configured');
        return new Response(
          JSON.stringify({ error: 'META_APP_TOKEN not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use Meta Graph API oEmbed endpoints
      const oembedUrl =
        platform === 'instagram'
          ? `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${metaToken}`
          : `https://graph.facebook.com/v18.0/oembed_post?url=${encodeURIComponent(url)}&access_token=${metaToken}`;

      console.log(`[fetch-meta-thumbnail] Calling Meta oEmbed API: ${platform}`);

      const response = await fetch(oembedUrl);

      if (response.ok) {
        const data = await response.json();
        console.log(`[fetch-meta-thumbnail] Meta response:`, JSON.stringify(data).substring(0, 300));
        
        const rawThumbnail = data.thumbnail_url || '';
        // Instagram oEmbed returns the caption in the 'title' field
        // We store it as description for our CollapsibleCaption
        description = data.title || '';
        
        // Use author_name as the title if available
        title = data.author_name || '';
        
        // CRITICAL: Store thumbnail permanently to avoid CDN expiration
        if (rawThumbnail) {
          const permanentUrl = await storeThumbnailPermanently(rawThumbnail);
          thumbnail = permanentUrl || rawThumbnail; // Fallback to raw if storage fails
        }
      } else {
        const errorText = await response.text();
        console.error(`[fetch-meta-thumbnail] Meta API error: ${response.status} - ${errorText}`);

        // Fallback for Instagram - try public oEmbed
        if (platform === 'instagram') {
          try {
            const publicResponse = await fetch(`https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`);
            if (publicResponse.ok) {
              const publicData = await publicResponse.json();
              const rawThumbnail = publicData.thumbnail_url || '';
              // Caption from public oEmbed
              description = publicData.title || '';
              title = publicData.author_name || '';
              
              // Store permanently
              if (rawThumbnail) {
                const permanentUrl = await storeThumbnailPermanently(rawThumbnail);
                thumbnail = permanentUrl || rawThumbnail;
              }
              console.log(`[fetch-meta-thumbnail] Instagram public oEmbed worked, stored permanently`);
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

    console.log(`[fetch-meta-thumbnail] Result - thumbnail: ${thumbnail ? thumbnail.substring(0, 60) + '...' : 'none'}, title: ${title}, description: ${description ? description.substring(0, 40) + '...' : 'none'}`);

    return new Response(
      JSON.stringify({ thumbnail, title, description }),
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
