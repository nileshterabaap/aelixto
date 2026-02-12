import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[fetch-oembed] Processing:', url);
    let embedHtml: string | null = null;
    let platform: string | null = null;

    const urlLower = url.toLowerCase();

    // YouTube oEmbed → returns responsive iframe
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      platform = 'youtube';
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json&maxwidth=560`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.html) {
            // Make iframe responsive: remove fixed dimensions, add 100% width
            embedHtml = data.html
              .replace(/width="\d+"/, 'width="100%"')
              .replace(/height="\d+"/, 'height="100%"')
              .replace('<iframe', '<iframe style="aspect-ratio:16/9;width:100%;height:auto"');
            console.log('[fetch-oembed] YouTube oEmbed success');
          }
        }
      } catch (e) {
        console.error('[fetch-oembed] YouTube oEmbed failed:', e);
      }
    }

    // Spotify oEmbed → returns iframe
    if (urlLower.includes('spotify.com') || urlLower.includes('open.spotify.com')) {
      platform = 'spotify';
      try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.html) {
            embedHtml = data.html;
            console.log('[fetch-oembed] Spotify oEmbed success');
          }
        }
      } catch (e) {
        console.error('[fetch-oembed] Spotify oEmbed failed:', e);
      }
    }

    // Twitter/X oEmbed → returns blockquote (needs widgets.js but HTML is pre-cached)
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      platform = 'twitter';
      try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.html) {
            embedHtml = data.html;
            console.log('[fetch-oembed] Twitter oEmbed success');
          }
        }
      } catch (e) {
        console.error('[fetch-oembed] Twitter oEmbed failed:', e);
      }
    }

    // Instagram - build direct iframe embed (bypasses unreliable SDK)
    if (urlLower.includes('instagram.com')) {
      platform = 'instagram';
      try {
        const u = new URL(url);
        // Clean the path - remove trailing slash, add /embed/
        let embedPath = u.pathname.replace(/\/$/, '') + '/embed/';
        const embedUrl = `https://www.instagram.com${embedPath}`;
        embedHtml = `<iframe src="${embedUrl}" style="border:0;width:100%;min-height:500px;" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
        console.log('[fetch-oembed] Instagram iframe embed built');
      } catch (e) {
        // Fallback: just append /embed/ to the cleaned URL
        const cleanUrl = url.split('?')[0].replace(/\/$/, '');
        embedHtml = `<iframe src="${cleanUrl}/embed/" style="border:0;width:100%;min-height:500px;" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
        console.log('[fetch-oembed] Instagram iframe embed built (fallback)');
      }
    }

    // Pinterest oEmbed
    if (urlLower.includes('pinterest.com') || urlLower.includes('pin.it')) {
      platform = 'pinterest';
      try {
        const oembedUrl = `https://www.pinterest.com/oembed/?url=${encodeURIComponent(url)}&format=json`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.html) {
            embedHtml = data.html;
            console.log('[fetch-oembed] Pinterest oEmbed success');
          }
        }
      } catch (e) {
        console.error('[fetch-oembed] Pinterest oEmbed failed:', e);
      }
    }

    // Facebook oEmbed (requires Meta token)
    if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) {
      platform = 'facebook';
      const metaToken = Deno.env.get('META_APP_TOKEN');
      if (metaToken) {
        try {
          const isVideo = url.includes('/videos/') || url.includes('/watch/') || url.includes('/reel/') || url.includes('fb.watch');
          const endpoint = isVideo ? 'oembed_video' : 'oembed_post';
          const oembedUrl = `https://graph.facebook.com/v18.0/${endpoint}?url=${encodeURIComponent(url)}&access_token=${metaToken}&omitscript=true`;
          const res = await fetch(oembedUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.html) {
              embedHtml = data.html;
              console.log('[fetch-oembed] Facebook oEmbed success');
            }
          }
        } catch (e) {
          console.error('[fetch-oembed] Facebook oEmbed failed:', e);
        }
      }
    }

    return new Response(
      JSON.stringify({ embed_html: embedHtml, platform }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[fetch-oembed] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
