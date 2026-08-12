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
    // Origin validation - use exact matches for production, pattern matching for dev
    const origin = req.headers.get('origin') || '';
    
    // Exact production origins
    const allowedOrigins = [
      'https://aelixto.com',
      'https://www.aelixto.com',
      'https://localhost',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ];
    
    // Development patterns (Lovable preview, webcontainer)
    const isDev = origin.includes('.lovable.app') || origin.includes('.lovableproject.com') || origin.includes('webcontainer');
    
    // Allow if origin is empty (same-origin), exact match, or dev environment
    const isAllowed = origin === '' || allowedOrigins.includes(origin) || isDev;
    
    if (!isAllowed) {
      console.log('[record-view] Origin rejected:', origin);
      return new Response(
        JSON.stringify({ ok: false, reason: 'Origin not allowed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { post_id, event_type, duration_ms, device_hash, viewer_id } = await req.json();

    // Validate event_type
    if (!['video_play', 'image_view', 'article_open', 'external_visit', 'original_visit'].includes(event_type)) {
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

    // Get post author_id and platform
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id, platform')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      console.error('Post lookup error:', postError);
      return new Response(
        JSON.stringify({ ok: false, reason: 'Post not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Silently skip self-view tracking (not an error, just don't count it)
    if (viewer_id && viewer_id === post.user_id) {
      console.log('[record-view] Skipping self-view', { post_id, viewer_id });
      return new Response(
        JSON.stringify({ ok: true, skipped: true, reason: 'Self-view not counted' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Threads embeds can emit multiple parent-page signals from a single user
    // action when several Threads posts are mounted (the SDK inflates an
    // in-page blockquote, so one tap can trigger listeners on siblings). X
    // does NOT have this problem — its iframe blur check is scoped per-post
    // and its image_view timer is per-tracker — so X must NOT be collapsed
    // here or legitimate sequential views get silently dropped.
    const platform = String(post.platform || '').toLowerCase();
    const isThreadsPost = platform.includes('threads');
    const isBurstyPlatform = isThreadsPost;
    const platformPattern = '%threads%';
    // Only collapse the events that actually leak across mounted Threads posts
    // from a single interaction. image_view is per-post-timer and safe.
    const isBurstEvent = ['video_play', 'original_visit'].includes(event_type);

    if (isBurstyPlatform && isBurstEvent) {
      // Tight window: a single blur/pointer event on one iframe reaches every
      // mounted sibling listener within a few frames. 800ms is comfortably
      // above that, well below any plausible sequential user interaction.
      const since = new Date(Date.now() - 800).toISOString();
      const { data: recentViews, error: burstError } = await supabase
        .from('post_views')
        .select('post_id')
        .eq('event_type', event_type)
        .neq('post_id', post_id)
        .eq('device_hash', device_hash)
        .gte('created_at', since)
        .limit(8);

      if (!burstError && recentViews && recentViews.length > 0) {
        const recentPostIds = [...new Set(recentViews.map((row: { post_id: string }) => row.post_id))];
        const { data: recentSamePlatformPost } = await supabase
          .from('posts')
          .select('id')
          .in('id', recentPostIds)
          .ilike('platform', platformPattern)
          .limit(1);

        if (recentSamePlatformPost && recentSamePlatformPost.length > 0) {
          console.log('[record-view] Skipping burst duplicate', { post_id, event_type, platform });
          return new Response(
            JSON.stringify({ ok: true, skipped: true, reason: 'Platform burst duplicate' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
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
