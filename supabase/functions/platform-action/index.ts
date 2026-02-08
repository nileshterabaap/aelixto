import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OUTSTAND_BASE_URL = 'https://api.outstand.dev/v1';

// Platform action endpoints
const actionEndpoints: Record<string, Record<string, string>> = {
  instagram: {
    like: '/instagram/media/{id}/like',
    unlike: '/instagram/media/{id}/unlike',
    comment: '/instagram/media/{id}/comment',
  },
  tiktok: {
    like: '/tiktok/video/{id}/like',
    unlike: '/tiktok/video/{id}/unlike',
    comment: '/tiktok/video/{id}/comment',
  },
  youtube: {
    like: '/youtube/video/{id}/rate',
    unlike: '/youtube/video/{id}/rate',
    comment: '/youtube/video/{id}/comment',
  },
  x: {
    like: '/twitter/tweet/{id}/like',
    unlike: '/twitter/tweet/{id}/unlike',
    comment: '/twitter/tweet/{id}/reply',
    retweet: '/twitter/tweet/{id}/retweet',
  },
  twitter: {
    like: '/twitter/tweet/{id}/like',
    unlike: '/twitter/tweet/{id}/unlike',
    comment: '/twitter/tweet/{id}/reply',
    retweet: '/twitter/tweet/{id}/retweet',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, platform, contentId, commentText } = await req.json();

    if (!action || !platform || !contentId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has connected this platform
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: connection, error: connError } = await supabaseAdmin
      .from('connected_socials')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'Platform not connected', code: 'NOT_CONNECTED' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired and needs refresh
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      // TODO: Implement token refresh via Outstand API
      return new Response(
        JSON.stringify({ error: 'Token expired, please reconnect', code: 'TOKEN_EXPIRED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OUTSTAND_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const platformActions = actionEndpoints[platform];
    if (!platformActions || !platformActions[action]) {
      return new Response(
        JSON.stringify({ error: 'Unsupported action for this platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const endpoint = platformActions[action].replace('{id}', contentId);
    
    console.log(`[platform-action] Executing ${action} on ${platform} for content ${contentId}`);

    const body: Record<string, unknown> = {
      user_access_token: connection.access_token,
    };

    if (action === 'comment' && commentText) {
      body.text = commentText;
    }

    if (platform === 'youtube' && (action === 'like' || action === 'unlike')) {
      body.rating = action === 'like' ? 'like' : 'none';
    }

    const response = await fetch(`${OUTSTAND_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[platform-action] API error:`, errorText);
      return new Response(
        JSON.stringify({ error: 'Platform action failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[platform-action] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
