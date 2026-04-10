import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Mirrors PLATFORM_REGISTRY from the frontend config */
const PLATFORM_DOMAINS: Record<string, string[]> = {
  instagram: ['instagram.com'],
  threads: ['threads.net', 'threads.com'],
  facebook: ['facebook.com', 'fb.watch', 'fb.me'],
  youtube: ['youtube.com', 'youtu.be'],
  twitter: ['x.com', 'twitter.com'],
  reddit: ['reddit.com', 'redd.it'],
  linkedin: ['linkedin.com'],
  pinterest: ['pinterest.com', 'pin.it'],
  tiktok: ['tiktok.com'],
  spotify: ['spotify.com'],
  quora: ['quora.com'],
};

const ARTICLE_DOMAINS = [
  'medium.com', 'substack.com', 'ghost.io', 'wordpress.com',
  'hashnode.com', 'dev.to', 'mirror.xyz', 'blogger.com',
];

function classifyPlatform(url: string): string {
  const lower = url.toLowerCase();
  for (const [key, domains] of Object.entries(PLATFORM_DOMAINS)) {
    if (domains.some(d => lower.includes(d))) return key;
  }
  if (ARTICLE_DOMAINS.some(d => lower.includes(d))) return 'article';
  return 'external';
}

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
    let platform: string | null = classifyPlatform(url);

    const urlLower = url.toLowerCase();

    // YouTube oEmbed → returns responsive iframe
    if (platform === 'youtube') {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json&maxwidth=560`;
        const res = await fetch(oembedUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.html) {
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
    if (platform === 'spotify') {
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

    // Twitter/X oEmbed
    if (platform === 'twitter') {
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

    // Instagram - build direct iframe embed
    if (platform === 'instagram') {
      try {
        const u = new URL(url);
        let embedPath = u.pathname.replace(/\/$/, '') + '/embed/captioned/';
        const embedUrl = `https://www.instagram.com${embedPath}`;
        embedHtml = `<iframe src="${embedUrl}" style="border:0;width:100%;min-height:500px;" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
        console.log('[fetch-oembed] Instagram iframe embed built');
      } catch (e) {
        const cleanUrl = url.split('?')[0].replace(/\/$/, '');
        embedHtml = `<iframe src="${cleanUrl}/embed/" style="border:0;width:100%;min-height:500px;" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
        console.log('[fetch-oembed] Instagram iframe embed built (fallback)');
      }
    }

    // Pinterest oEmbed
    if (platform === 'pinterest') {
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

    // Facebook oEmbed + direct iframe fallback
    if (platform === 'facebook') {
      const stripFacebookTrackingParams = (raw: string) => {
        try {
          const u = new URL(raw);
          ['mibextid', 'ref', 'refid', 'sfnsn', 'app', 'paipv', 'rdid', 'share_url'].forEach((p) => {
            u.searchParams.delete(p);
          });
          u.hash = '';
          return u.toString();
        } catch {
          return raw;
        }
      };

      let resolvedFacebookUrl = url;

      if (urlLower.includes('/share/') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) {
        try {
          const expanded = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (AelixtoBot/1.0)' },
          });
          if (expanded.url) {
            resolvedFacebookUrl = expanded.url;
            console.log('[fetch-oembed] Facebook URL expanded to:', resolvedFacebookUrl);
          }
        } catch (e) {
          console.warn('[fetch-oembed] Facebook URL expansion failed, using original URL:', e);
        }
      }

      const canonicalFacebookUrl = stripFacebookTrackingParams(resolvedFacebookUrl);
      // Even if /share/ didn't expand, still try the plugin iframe — Facebook handles redirects
      const unresolvedShare = canonicalFacebookUrl.includes('/share/') && resolvedFacebookUrl === url;
      const isVideo =
        canonicalFacebookUrl.includes('/reel/') ||
        canonicalFacebookUrl.includes('/videos/') ||
        canonicalFacebookUrl.includes('/watch/') ||
        canonicalFacebookUrl.includes('fb.watch');

      // Use SDK-based divs instead of plugin iframes — Facebook blocks plugin
      // iframes via X-Frame-Options on third-party domains.
      const sdkClass = isVideo ? 'fb-video' : 'fb-post';
      const fallbackHtml = `<div class="${sdkClass}" data-href="${canonicalFacebookUrl}" data-width="auto" data-show-text="true"></div>`;

      const metaToken = Deno.env.get('META_APP_TOKEN');
      if (metaToken && !unresolvedShare) {
        try {
          const endpoint = isVideo ? 'oembed_video' : 'oembed_post';
          const oembedUrl = `https://graph.facebook.com/v18.0/${endpoint}?url=${encodeURIComponent(canonicalFacebookUrl)}&access_token=${metaToken}&omitscript=true`;
          const res = await fetch(oembedUrl);

          if (res.ok) {
            const data = await res.json();
            if (data.html) {
              // Accept both iframes and blockquotes from oEmbed —
              // the RawEmbedRenderer SDK path handles both.
              embedHtml = data.html;
              console.log('[fetch-oembed] Facebook oEmbed success');
            }
          } else {
            const errorText = await res.text();
            console.warn('[fetch-oembed] Facebook oEmbed non-200, using SDK fallback:', errorText);
          }
        } catch (e) {
          console.error('[fetch-oembed] Facebook oEmbed failed:', e);
        }
      }

      if (!embedHtml) {
        embedHtml = fallbackHtml;
        console.log('[fetch-oembed] Facebook SDK fallback built');
      }
    }

    // Reddit oEmbed
    if (platform === 'reddit') {
      try {
        const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
        const res = await fetch(oembedUrl, {
          headers: { 'User-Agent': 'Aelixto/1.0' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.html) {
            embedHtml = data.html;
            console.log('[fetch-oembed] Reddit oEmbed success');
          }
        }
      } catch (e) {
        console.error('[fetch-oembed] Reddit oEmbed failed:', e);
      }
    }

    // TikTok direct iframe embed (fastest, no SDK needed)
    if (platform === 'tiktok') {
      try {
        const tiktokUrl = new URL(url);
        const videoMatch = tiktokUrl.pathname.match(/\/@[^/]+\/video\/(\d+)/);
        if (videoMatch) {
          const videoId = videoMatch[1];
          embedHtml = `<iframe src="https://www.tiktok.com/embed/v2/${videoId}" style="border:none;width:100%;height:740px;display:block;" allowfullscreen allow="encrypted-media; autoplay" loading="lazy"></iframe>`;
          console.log('[fetch-oembed] TikTok iframe embed built for video:', videoId);
        } else {
          // Fallback to oEmbed for non-standard URLs
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
          const res = await fetch(oembedUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.html) {
              // Extract video ID from oEmbed response and build iframe
              const idMatch = data.html?.match(/data-video-id="(\d+)"/);
              if (idMatch) {
                embedHtml = `<iframe src="https://www.tiktok.com/embed/v2/${idMatch[1]}" style="border:none;width:100%;height:740px;display:block;" allowfullscreen allow="encrypted-media; autoplay" loading="lazy"></iframe>`;
              } else {
                embedHtml = data.html;
              }
              console.log('[fetch-oembed] TikTok oEmbed fallback success');
            }
          }
        }
      } catch (e) {
        console.error('[fetch-oembed] TikTok embed failed:', e);
      }
    }

    // Threads / LinkedIn — no oEmbed available, platform already classified
    if (platform === 'threads' || platform === 'linkedin') {
      console.log(`[fetch-oembed] ${platform} detected — client-side rendering`);
    }

    // Article platforms — client-side ArticleEmbed handles rendering
    if (platform === 'article') {
      console.log('[fetch-oembed] Article platform detected — client-side rendering');
    }

    // External — no special embed
    if (platform === 'external') {
      console.log('[fetch-oembed] External URL — no oEmbed available');
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
