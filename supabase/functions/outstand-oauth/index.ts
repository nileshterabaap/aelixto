import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OUTSTAND_BASE_URL = 'https://api.outstand.dev/v1';

// Platform-specific OAuth endpoints
const platformOAuthConfig: Record<string, { authPath: string; callbackPath: string }> = {
  instagram: { authPath: '/instagram/oauth/authorize', callbackPath: '/instagram/oauth/callback' },
  tiktok: { authPath: '/tiktok/oauth/authorize', callbackPath: '/tiktok/oauth/callback' },
  youtube: { authPath: '/youtube/oauth/authorize', callbackPath: '/youtube/oauth/callback' },
  x: { authPath: '/twitter/oauth/authorize', callbackPath: '/twitter/oauth/callback' },
  twitter: { authPath: '/twitter/oauth/authorize', callbackPath: '/twitter/oauth/callback' },
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

    const { action, platform, redirectUrl, code, state } = await req.json();
    const apiKey = Deno.env.get('OUTSTAND_API_KEY');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = platformOAuthConfig[platform];
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Unsupported platform' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'initiate') {
      // Generate state for CSRF protection
      const oauthState = crypto.randomUUID();
      
      // Store state temporarily (you might want to use a proper session store)
      const supabaseAdmin = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Request OAuth URL from Outstand
      const response = await fetch(`${OUTSTAND_BASE_URL}${config.authPath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirect_uri: redirectUrl,
          state: oauthState,
          user_id: user.id,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[outstand-oauth] Failed to get auth URL:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to initiate OAuth' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      
      return new Response(
        JSON.stringify({ authUrl: data.auth_url || data.authorization_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'callback') {
      // Exchange code for tokens
      const response = await fetch(`${OUTSTAND_BASE_URL}${config.callbackPath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          redirect_uri: redirectUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[outstand-oauth] Token exchange failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'OAuth callback failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenData = await response.json();

      // Store the connection in database
      const supabaseAdmin = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { error: upsertError } = await supabaseAdmin
        .from('connected_socials')
        .upsert({
          user_id: user.id,
          platform,
          platform_user_id: tokenData.user_id || tokenData.account_id,
          platform_username: tokenData.username || tokenData.screen_name || tokenData.handle,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: tokenData.expires_at ? new Date(tokenData.expires_at).toISOString() : null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,platform',
        });

      if (upsertError) {
        console.error('[outstand-oauth] Failed to store connection:', upsertError);
        return new Response(
          JSON.stringify({ error: 'Failed to store connection' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          platform,
          username: tokenData.username || tokenData.screen_name,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[outstand-oauth] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
