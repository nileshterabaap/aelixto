import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash helper using Web Crypto API
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Origin validation
    const origin = req.headers.get('origin') || '';
    const allowedOrigins = ['aelixto.com', '.lovable.dev', 'localhost'];
    const isAllowed = allowedOrigins.some(domain => 
      origin.includes(domain) || origin.includes('localhost')
    );
    
    if (!isAllowed && !origin.includes('127.0.0.1')) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Origin not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { post_id, event_type, duration_ms, device_hash, viewer_id } = await req.json();

    // Validate event_type
    if (!['video_play', 'image_view'].includes(event_type)) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Invalid event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate image_view duration
    if (event_type === 'image_view' && duration_ms < 2000) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'image_view requires duration_ms >= 2000' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!post_id || !device_hash) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get post author_id
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      console.error('Post lookup error:', postError);
      return new Response(
        JSON.stringify({ ok: false, reason: 'Post not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash IP server-side
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    const ipHash = await sha256(clientIp);

    // Insert into post_views (unique index handles deduplication)
    const { error: insertError } = await supabase
      .from('post_views')
      .insert({
        post_id,
        author_id: post.user_id,
        viewer_id: viewer_id || null,
        device_hash,
        ip_hash: ipHash,
        event_type,
        duration_ms: duration_ms || 0,
      });

    if (insertError) {
      // Check if it's a unique constraint violation (cooldown active)
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ ok: true, reason: 'Already counted (cooldown)' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ ok: false, reason: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ ok: false, reason: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
