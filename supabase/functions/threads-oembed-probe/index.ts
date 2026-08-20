import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const isThreadsUrl = (raw: string) => {
  try {
    const u = new URL(raw);
    return /(^|\.)threads\.(net|com)$/.test(u.hostname);
  } catch {
    return false;
  }
};

/**
 * Probe-only: asks Meta's official Threads oEmbed endpoint for the embed HTML
 * of a single post. Not used by the production feed. Requires a Threads/Meta
 * app access token in THREADS_OEMBED_TOKEN; without it we report the exact
 * upstream error so the APK probe can show it verbatim.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || !isThreadsUrl(url)) {
      return new Response(JSON.stringify({ error: 'Provide a threads.net/threads.com post url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = Deno.env.get('THREADS_OEMBED_TOKEN') || '';
    const endpoint =
      `https://graph.threads.net/oembed?url=${encodeURIComponent(url)}` +
      `&omitscript=true&hidecaption=false` +
      (token ? `&access_token=${encodeURIComponent(token)}` : '');

    const res = await fetch(endpoint, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      // keep raw text
    }

    return new Response(
      JSON.stringify({
        ok: res.ok,
        status: res.status,
        hasToken: !!token,
        endpoint: endpoint.replace(/access_token=[^&]+/, 'access_token=***'),
        data: payload,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
