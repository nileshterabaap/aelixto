import { useState, useEffect, useRef, useCallback } from 'react';
import { RawEmbedRenderer } from '@/components/RawEmbedRenderer';
import { OgCardFallback } from '@/components/OgCardFallback';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';
import { usePersistEmbedHeight } from '@/hooks/usePersistEmbedHeight';
import { openExternalUrl } from '@/lib/openExternalUrl';

/**
 * Small pill-shaped overlay button rendered on top of an embed iframe so
 * the user can always open the original post on its source platform, even
 * when the iframe swallows every tap. Positioned so it never covers the
 * platform's native Play button (top-right corner).
 */
const OpenOriginalPill = ({ url, label }: { url: string; label: string }) => {
  if (!url) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void openExternalUrl(url);
      }}
      className="absolute top-2 right-2 z-10 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 shadow-sm active:scale-95 transition-transform pointer-events-auto"
      aria-label={label}
    >
      {label}
    </button>
  );
};

const THREADS_MIN_HEIGHT = 220;
const THREADS_MAX_HEIGHT = 1400;
const THREADS_DEFAULT_HEIGHT = 280;

const clampThreadsHeight = (height: number) =>
  Math.min(THREADS_MAX_HEIGHT, Math.max(THREADS_MIN_HEIGHT, Math.round(height)));

const parseThreadsHeightFromMessage = (data: unknown): number | null => {
  let payload: unknown = data;

  if (typeof payload === 'number' && Number.isFinite(payload)) {
    return payload;
  }

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;

    visited.add(current);
    const record = current as Record<string, unknown>;

    const directHeightCandidates = [
      record.height,
      record.iframeHeight,
      record.frameHeight,
      (record.dimensions as Record<string, unknown> | undefined)?.height,
      (record.size as Record<string, unknown> | undefined)?.height,
    ];

    for (const candidate of directHeightCandidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
    }

    Object.values(record).forEach((value) => {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    });
  }

  return null;
};

/**
 * Threads iframe that listens for resize messages and adapts height per post.
 */
const ThreadsIframeEmbed = ({
  src,
  expandedUrl,
  fallbackData,
  postId,
  suggestedHeight,
}: {
  src: string;
  expandedUrl: string;
  fallbackData: { title?: string; image?: string; description?: string } | null;
  postId?: string | null;
  suggestedHeight?: number | null;
}) => {
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState(() =>
    suggestedHeight && suggestedHeight >= THREADS_MIN_HEIGHT
      ? Math.min(THREADS_MAX_HEIGHT, suggestedHeight)
      : THREADS_DEFAULT_HEIGHT
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const persistHeight = usePersistEmbedHeight(postId);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;

      const isThreadsOrigin =
        event.origin.includes('threads.net') || event.origin.includes('threads.com');
      if (!isThreadsOrigin) return;

      const nextHeight = parseThreadsHeightFromMessage(event.data);
      if (!nextHeight) return;

      const clampedHeight = clampThreadsHeight(nextHeight);
      setHeight((prev) => (Math.abs(prev - clampedHeight) > 2 ? clampedHeight : prev));
      persistHeight(clampedHeight);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasLoaded) {
        setFailed(true);
      }
    }, 6000);

    return () => clearTimeout(timeout);
  }, [hasLoaded]);

  if (failed) {
    return (
      <OgCardFallback
        url={expandedUrl}
        title={fallbackData?.title}
        image={fallbackData?.image}
        description={fallbackData?.description}
        platform="Threads"
      />
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ width: '100%', height: `${height}px`, minHeight: `${THREADS_MIN_HEIGHT}px` }}
    >
      <iframe
        ref={iframeRef}
        src={src}
        scrolling="no"
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
        loading="lazy"
        onLoad={() => setHasLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          margin: 0,
          padding: 0,
          background: 'transparent',
        }}
      />
    </div>
  );
};

/**
 * Instagram iframe that adapts its visible height per post.
 *
 * Instagram's direct /embed/ iframe sends an exact MEASURE height for the
 * rendered card. The previous large trim was based on /embed/captioned/ and
 * caused exactly the two failures the user reported: short posts kept a huge
 * blank area, while medium posts were cropped. Use the live /embed/ height and
 * only trim the Instagram controls/comment footer so the media is complete and
 * Instagram's duplicate action buttons don't show above Aelix's own actions.
 */
const IG_BOTTOM_CONTROLS_TRIM = 112;
const IG_MIN_VISIBLE = 260;
const IG_MAX_VISIBLE = 1000;
const IG_DEFAULT_VISIBLE = 460;
const IG_MAX_TRUSTED_SUGGESTED_HEIGHT = 900;

const clampIgVisible = (h: number) =>
  Math.min(IG_MAX_VISIBLE, Math.max(IG_MIN_VISIBLE, Math.round(h)));

const InstagramIframeEmbed = ({
  src,
  postId,
  suggestedHeight,
  expandedUrl,
}: {
  src: string;
  postId?: string | null;
  suggestedHeight?: number | null;
  expandedUrl?: string;
}) => {
  const isReel = /\/reel\//i.test(src);
  const estimateVisibleHeight = useCallback((width?: number | null) => {
    if (!width || width < 240) return isReel ? 640 : IG_DEFAULT_VISIBLE;
    // Use a conservative media-only estimate for the first paint. Instagram's
    // real MEASURE height will correct this, but starting below the footer line
    // guarantees their native actions never flash before trimming settles.
    const mediaEstimate = isReel ? width * 1.72 + 56 : width * 1.25 + 58;
    return clampIgVisible(mediaEstimate);
  }, [isReel]);

  const [visible, setVisible] = useState(() => {
    // Older saved Instagram heights may have come from /embed/captioned/ and
    // can be 1000px+. Ignore those stale captioned values; the live /embed/
    // MEASURE message will replace the fallback almost immediately.
    if (suggestedHeight && suggestedHeight <= IG_MAX_TRUSTED_SUGGESTED_HEIGHT) {
      return Math.min(
        clampIgVisible(suggestedHeight - IG_BOTTOM_CONTROLS_TRIM),
        estimateVisibleHeight(null)
      );
    }
    return estimateVisibleHeight(null);
  });
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const measuredRef = useRef(false);
  const revealTimerRef = useRef<number | null>(null);
  const persistHeight = usePersistEmbedHeight(postId);

  const reveal = useCallback(() => {
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => setReady(true), 140);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const updateEstimate = () => {
      if (measuredRef.current) return;
      const next = estimateVisibleHeight(root.getBoundingClientRect().width);
      setVisible((prev) => (Math.abs(prev - next) > 4 ? next : prev));
    };

    updateEstimate();
    const ro = new ResizeObserver(updateEstimate);
    ro.observe(root);
    return () => ro.disconnect();
  }, [estimateVisibleHeight]);

  useEffect(() => {
    if (!ready) return;
    rootRef.current?.dispatchEvent(new CustomEvent('embedReady', { bubbles: true }));
  }, [ready]);

  useEffect(() => {
    // Hard fallback: if Instagram withholds MEASURE on a slow/device-specific
    // load, reveal the conservative cropped state instead of ever exposing the
    // full footer/actions area.
    const fallback = window.setTimeout(() => setReady(true), 2200);
    return () => {
      window.clearTimeout(fallback);
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;
      const origin = event.origin || '';
      if (!origin.includes('instagram.com') && !origin.includes('cdninstagram.com')) return;

      const full = parseThreadsHeightFromMessage(event.data);
      if (!full || full < IG_MIN_VISIBLE) return;

      measuredRef.current = true;
      const nextVisible = clampIgVisible(full - IG_BOTTOM_CONTROLS_TRIM);
      setVisible((prev) => (Math.abs(prev - nextVisible) > 4 ? nextVisible : prev));
      // Persist the FULL /embed/ iframe height. Render-time trims only the IG
      // controls/footer, and the live message keeps old captioned values healed.
      persistHeight(Math.round(full));
      reveal();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [persistHeight, reveal]);

  return (
    <div
      ref={rootRef}
      data-embed-status={ready ? 'ready' : 'loading'}
      className={`relative w-full overflow-hidden bg-muted/70 ${
        ready ? '' : 'before:absolute before:inset-0 before:z-[1] before:bg-gradient-to-r before:from-transparent before:via-background/70 before:to-transparent before:animate-shimmer'
      }`}
      style={{ width: '100%', height: `${visible}px`, touchAction: 'pan-y' }}
    >
      <iframe
        ref={iframeRef}
        src={src}
        scrolling="no"
        allowFullScreen
        allow="encrypted-media; autoplay"
        loading="lazy"
        style={{
          border: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${visible + IG_BOTTOM_CONTROLS_TRIM}px`,
          overflow: 'hidden',
          display: 'block',
          opacity: ready ? 1 : 0,
          pointerEvents: ready ? 'auto' : 'none',
          transition: 'opacity 180ms ease-out',
        }}
      />
    </div>
  );
};
/**
 * Facebook iframe that auto-sizes to its content height.
 * Falls back to a generous min-height, then listens for the Facebook
 * plugins cross-origin resize message to snap to exact content height.
 */
const FacebookIframeEmbed = ({
  html,
  expandedUrl,
  fallbackData,
  postId,
  suggestedHeight,
}: {
  html: string;
  expandedUrl: string;
  fallbackData: { title?: string; image?: string; description?: string } | null;
  postId?: string | null;
  suggestedHeight?: number | null;
}) => {
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const persistHeight = usePersistEmbedHeight(postId);
  // Render Facebook's plugin iframe at fixed dimensions, matching Facebook's
  // official embed exactly. For reels/videos we use 267x476 (Facebook's own
  // Reel embed size) so the plugin renders its native viewport with no
  // shifting on play/pause. For static posts we keep width=500 and follow
  // the plugin's postMessage-reported height (posts vary in height).

  const srcMatch = html.match(/src="([^"]+)"/);
  const rawIframeSrc = srcMatch ? srcMatch[1] : '';

  const isVideo = /\/(video\.php|reel|videos|watch)/i.test(rawIframeSrc) || /fb\.watch/i.test(rawIframeSrc);

  // Fixed native dimensions for videos/reels (matches Facebook's official embed).
  const VIDEO_WIDTH = 267;
  const VIDEO_HEIGHT = 476;

  // Ensure the plugin src carries both width and height for videos so
  // Facebook's plugin lays itself out at its native Reel size — no runtime
  // src rewriting, no ResizeObserver.
  const iframeSrc = (() => {
    if (!rawIframeSrc) return rawIframeSrc;
    try {
      const u = new URL(rawIframeSrc);
      if (isVideo) {
        u.searchParams.set('width', String(VIDEO_WIDTH));
        u.searchParams.set('height', String(VIDEO_HEIGHT));
        u.searchParams.set('show_text', 'false');
      } else {
        if (!u.searchParams.get('width')) u.searchParams.set('width', '500');
      }
      return u.toString();
    } catch {
      return rawIframeSrc;
    }
  })();

  // Post-only: follow plugin's reported height via postMessage.
  const POST_MIN_HEIGHT = 160;
  const POST_MAX_HEIGHT = 1200;
  const POST_DEFAULT_HEIGHT = 360;
  const POST_MAX_TRUSTED_SUGGESTED = 1000;
  const [postHeight, setPostHeight] = useState(() => {
    if (
      !isVideo &&
      suggestedHeight &&
      suggestedHeight >= POST_MIN_HEIGHT &&
      suggestedHeight <= POST_MAX_TRUSTED_SUGGESTED
    ) {
      return Math.min(POST_MAX_HEIGHT, suggestedHeight);
    }
    return POST_DEFAULT_HEIGHT;
  });

  useEffect(() => {
    if (isVideo) return;
    const handler = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;
      const origin = event.origin || '';
      if (!origin.includes('facebook.com')) return;
      const next = parseThreadsHeightFromMessage(event.data);
      if (!next || next < 80) return;
      const clamped = Math.min(POST_MAX_HEIGHT, Math.max(POST_MIN_HEIGHT, Math.round(next)));
      setPostHeight((prev) => (Math.abs(prev - clamped) > 2 ? clamped : prev));
      persistHeight(clamped);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isVideo, persistHeight]);

  // Fallback: if iframe doesn't render in 12s, show OG card
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (iframeRef.current) {
        const rect = iframeRef.current.getBoundingClientRect();
        if (rect.height < 50) setFailed(true);
      }
    }, 12000);
    return () => clearTimeout(timeout);
  }, []);

  if (failed) {
    return (
      <OgCardFallback
        url={expandedUrl}
        title={fallbackData?.title}
        image={fallbackData?.image}
        description={fallbackData?.description}
        platform="Facebook"
      />
    );
  }

  if (isVideo) {
    // Fixed 267x476, centered — mirrors Facebook's official Reel embed.
    return (
      <div
        ref={wrapperRef}
        className="relative w-full overflow-hidden flex justify-center"
        style={{ touchAction: 'pan-y', width: '100%', height: `${VIDEO_HEIGHT}px` }}
      >
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          scrolling="no"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write; web-share"
          loading="lazy"
          onError={() => setFailed(true)}
          style={{
            border: 'none',
            width: `${VIDEO_WIDTH}px`,
            height: `${VIDEO_HEIGHT}px`,
            overflow: 'hidden',
            display: 'block',
          }}
        />
      </div>
    );
  }

  // Static posts: fluid width, plugin drives height via postMessage.
  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden"
      style={{ touchAction: 'pan-y', width: '100%', height: `${postHeight}px` }}
    >
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        scrolling="no"
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write; web-share"
        loading="lazy"
        onError={() => setFailed(true)}
        style={{
          border: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${postHeight}px`,
          overflow: 'hidden',
          display: 'block',
        }}
      />
    </div>
  );
};

/**
 * LinkedIn iframe restored to a fixed, internally scrollable viewport.
 * LinkedIn cards can be taller than the Aelixto post card, so the iframe
 * itself must scroll instead of expanding the outer feed item.
 */
const LI_VIEWPORT_HEIGHT = 760;

const LinkedInIframeEmbed = ({
  src,
}: {
  src: string;
  postId?: string | null;
  suggestedHeight?: number | null;
  expandedUrl?: string;
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div
      className="relative w-full overflow-hidden bg-background"
      style={{ width: '100%', height: `${LI_VIEWPORT_HEIGHT}px`, minHeight: `${LI_VIEWPORT_HEIGHT}px`, touchAction: 'pan-y' }}
    >
      <iframe
        ref={iframeRef}
        src={src}
        scrolling="auto"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          minHeight: `${LI_VIEWPORT_HEIGHT}px`,
          display: 'block',
          background: 'hsl(var(--background))',
        }}
      />
    </div>
  );
};

/**
 * TikTok iframe that adapts to content height. TikTok's /embed/v2/ posts
 * cross-origin messages with the rendered card height.
 */
const TT_MIN_HEIGHT = 480;
const TT_MAX_HEIGHT = 900;
const TT_DEFAULT_HEIGHT = 740;

const TikTokIframeEmbed = ({
  src,
  postId,
  suggestedHeight,
}: {
  src: string;
  postId?: string | null;
  suggestedHeight?: number | null;
}) => {
  const [height, setHeight] = useState(() =>
    suggestedHeight && suggestedHeight >= TT_MIN_HEIGHT
      ? Math.min(TT_MAX_HEIGHT, suggestedHeight)
      : TT_DEFAULT_HEIGHT
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const persistHeight = usePersistEmbedHeight(postId);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;
      const origin = event.origin || '';
      if (!origin.includes('tiktok.com')) return;
      const next = parseThreadsHeightFromMessage(event.data);
      if (!next) return;
      const clamped = Math.min(TT_MAX_HEIGHT, Math.max(TT_MIN_HEIGHT, Math.round(next)));
      setHeight((prev) => (Math.abs(prev - clamped) > 4 ? clamped : prev));
      persistHeight(clamped);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ width: '100%', height: `${height}px`, touchAction: 'pan-y' }}
    >
      <iframe
        ref={iframeRef}
        src={src}
        scrolling="no"
        allowFullScreen
        allow="encrypted-media; autoplay"
        loading="lazy"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  );
};

interface UniversalMetaEmbedProps {
  url: string;
  postId?: string | null;
  suggestedHeight?: number | null;
}

// Cache resolved embeds to avoid re-processing when navigating between tabs/pages
// (keeps embeds feeling “instant” like Instagram).
type CachedEmbed = {
  embedHtml: string | null;
  fallbackData: { title?: string; image?: string; description?: string } | null;
  expandedUrl: string;
  embedUrl: string;
  showFallback: boolean;
};

const embedCache = new Map<string, CachedEmbed>();

// Detect platform from URL
const detectPlatform = (url: string): 'instagram' | 'facebook' | 'spotify' | 'reddit' | 'quora' | 'medium' | 'blog' | 'threads' | 'linkedin' | 'tiktok' | 'unknown' => {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) {
    return 'instagram';
  }
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch') || urlLower.includes('fb.me')) {
    return 'facebook';
  }
  if (urlLower.includes('spotify.com') || urlLower.includes('open.spotify.com')) {
    return 'spotify';
  }
  if (urlLower.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (urlLower.includes('reddit.com')) {
    return 'reddit';
  }
  if (urlLower.includes('quora.com')) {
    return 'quora';
  }
  if (urlLower.includes('medium.com')) {
    return 'medium';
  }
  if (urlLower.includes('threads.net') || urlLower.includes('threads.com')) {
    return 'threads';
  }
  if (urlLower.includes('linkedin.com')) {
    return 'linkedin';
  }
  if (
    urlLower.includes('blog') ||
    urlLower.includes('.wordpress.com') ||
    urlLower.includes('blogger.com') ||
    urlLower.includes('ghost.io') ||
    urlLower.includes('substack.com')
  ) {
    return 'blog';
  }
  return 'unknown';
};

// Build Instagram embed HTML using direct iframe (bypasses unreliable SDK)
const buildInstagramEmbed = (url: string): string => {
  // Extract the post/reel path and build a direct embed iframe URL
  // Instagram supports /embed/ suffix on post/reel URLs
  try {
    const u = new URL(url);
    // Clean the path - remove trailing slash, add /embed/
    let embedPath = u.pathname.replace(/\/$/, '') + '/embed/';
    const embedUrl = `https://www.instagram.com${embedPath}`;
    return `<iframe src="${embedUrl}" style="border:0;width:100%;overflow:hidden;" scrolling="no" allowfullscreen allow="encrypted-media; autoplay" loading="lazy"></iframe>`;
  } catch {
    // Fallback: just append /embed/ to the URL
    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
    return `<iframe src="${cleanUrl}/embed/" style="border:0;width:100%;overflow:hidden;" scrolling="no" allowfullscreen allow="encrypted-media; autoplay" loading="lazy"></iframe>`;
  }
};

// Normalize Facebook URLs for reliable embedding
const normalizeFacebookUrl = (raw: string): string => {
  let url = raw.trim();

  // 1) Always use www. instead of mobile variants
  url = url
    .replace(/^https?:\/\/m\.facebook\.com\//, 'https://www.facebook.com/')
    .replace(/^https?:\/\/lm\.facebook\.com\//, 'https://www.facebook.com/')
    .replace(/^https?:\/\/l\.facebook\.com\//, 'https://www.facebook.com/');

  // 2) If it's a login redirect, extract the actual post URL from "next" parameter.
  // Facebook photo/share links often route anonymous server-side expansion
  // through /login/?next=<story.php...>; that does NOT mean the post is
  // private. The plugins can render the next URL, but never the login URL.
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('facebook.com') && u.pathname.includes('/login') && u.searchParams.get('next')) {
      const actualUrl = decodeURIComponent(u.searchParams.get('next')!);
      url = actualUrl;
    }
  } catch (e) {
    console.warn('[FB EMBED] Failed to parse login redirect:', e);
  }

  // 3) If it's an l.facebook.com redirect, extract the "u" param
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('facebook.com') && u.pathname === '/l.php' && u.searchParams.get('u')) {
      const extractedUrl = decodeURIComponent(u.searchParams.get('u')!);
      url = extractedUrl;
    }
  } catch (e) {
    console.warn('[FB EMBED] Failed to parse redirect URL:', e);
  }

  // 4) Strip tracking / share junk that shouldn't affect the canonical post
  const stripParams = ['mibextid', 'ref', 'refid', 'sfnsn', 'app', 'paipv', 'rdid', 'share_url'];

  try {
    const u2 = new URL(url);
    stripParams.forEach((p) => u2.searchParams.delete(p));
    // Also drop hash fragments that aren't part of the post identity
    u2.hash = '';
    url = u2.toString();
  } catch (e) {
    console.warn('[FB EMBED] Failed to clean URL params:', e);
  }

  return url;
  return url;
};

// Build Facebook embed using direct iframe (bypasses slow SDK)
const buildFacebookEmbed = (url: string): string | null => {
  const canonical = normalizeFacebookUrl(url);
  // Share URLs (e.g. /share/v/..., /share/r/...) redirect and won't render in
  // facebook plugins directly. Skip immediate render — let URL expansion resolve them first.
  if (canonical.includes('/share/')) return null;

  const isVideo =
    canonical.includes('/reel/') ||
    canonical.includes('/videos/') ||
    canonical.includes('/watch/') ||
    canonical.includes('fb.watch');

  const pluginEndpoint = isVideo ? 'video.php' : 'post.php';
  const encodedUrl = encodeURIComponent(canonical);
  const query = isVideo
    ? `href=${encodedUrl}&width=500`
    : `href=${encodedUrl}&show_text=true&width=500`;

  // No hard-coded aspect-ratio: FacebookIframeEmbed rebuilds the src with
  // the real container width and lets Facebook's plugin drive the height
  // via postMessage so the embed matches Facebook's native viewport.
  return `<iframe src="https://www.facebook.com/plugins/${pluginEndpoint}?${query}" style="border:none;width:100%;overflow:hidden;" scrolling="no" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write; web-share" loading="lazy"></iframe>`;
};

// Check if Spotify URL is embeddable (not wrapped-share or other special pages)
const isEmbeddableSpotifyUrl = (url: string): boolean => {
  // Wrapped share URLs and other special pages can't be embedded
  if (url.includes('/wrapped-share/') || url.includes('/wrapped/')) {
    return false;
  }
  // Standard embeddable content types
  return (
    url.includes('/track/') ||
    url.includes('/album/') ||
    url.includes('/playlist/') ||
    url.includes('/artist/') ||
    url.includes('/episode/') ||
    url.includes('/show/')
  );
};

// Build Spotify embed HTML
const buildSpotifyEmbed = (url: string): string | null => {
  if (!isEmbeddableSpotifyUrl(url)) return null;
  let embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
  if (url.includes('/embed/')) embedUrl = url;
  return `<iframe style="border-radius:12px;display:block;" src="${embedUrl}" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
};

// Build LinkedIn embed HTML using their native embed endpoint
const buildLinkedInEmbed = (url: string): string | null => {
  try {
    const u = new URL(url);

    // Pattern 1: /feed/update/urn:li:activity:ID or urn:li:share:ID or urn:li:ugcPost:ID
    const feedMatch = u.pathname.match(/\/feed\/update\/(urn:li:\w+:\d+)/);
    if (feedMatch) {
      const urn = feedMatch[1];
      return `<iframe src="https://www.linkedin.com/embed/feed/update/${urn}" width="100%" frameborder="0" allowfullscreen="" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" style="border:none;overflow:hidden;display:block;" loading="lazy"></iframe>`;
    }

    // Pattern 2: /posts/username_slug-ugcPost-ID-hash or -activity-ID-hash
    // Note: separator before type can be underscore or hyphen
    const postMatch = u.pathname.match(/\/posts\/[^/]+[_-](?:ugcPost|activity)-(\d+)-/);
    if (postMatch) {
      const id = postMatch[1];
      const typeMatch = u.pathname.match(/[_-](ugcPost|activity)-/);
      const type = typeMatch ? typeMatch[1] : 'ugcPost';
      return `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:${type}:${id}" width="100%" frameborder="0" allowfullscreen="" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" style="border:none;overflow:hidden;display:block;" loading="lazy"></iframe>`;
    }

    // Pattern 3: /posts/username_slug-share-ID-hash
    const shareMatch = u.pathname.match(/\/posts\/[^/]+[_-]share-(\d+)-/);
    if (shareMatch) {
      return `<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:${shareMatch[1]}" width="100%" frameborder="0" allowfullscreen="" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" style="border:none;overflow:hidden;display:block;" loading="lazy"></iframe>`;
    }
  } catch {
    // Fall through to null
  }
  return null;
};

// Build Threads embed using direct iframe to the /embed page.
//
// Note: Threads' /embed page does NOT post resize messages, and their
// official SDK (embed.js) doesn't reliably re-process blockquotes in SPAs
// (no public process() API). The direct-iframe approach renders the actual
// post content; we use a conservative default height + create-time
// measurement + persistEmbedHeight to keep blank space minimal.
const buildThreadsEmbed = (url: string): string | null => {
  try {
    const u = new URL(url);
    const postMatch = u.pathname.match(/\/@([^/]+)\/post\/([A-Za-z0-9_-]+)/);
    if (postMatch) {
      const embedSrc = `https://www.threads.net${u.pathname.replace(/\/$/, '')}/embed`;
      return `<iframe src="${embedSrc}" style="border:0;width:100%;overflow:hidden;background:transparent;" scrolling="no" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>`;
    }
  } catch {
    // Fall through
  }
  return null;
};

// Build TikTok embed HTML using direct iframe (fastest, no SDK needed)
const buildTikTokEmbed = (url: string): string | null => {
  try {
    const u = new URL(url);
    // TikTok video URLs: /@user/video/ID
    const videoMatch = u.pathname.match(/\/@[^/]+\/video\/(\d+)/);
    if (videoMatch) {
      const videoId = videoMatch[1];
      // autoplay=0 keeps TikTok paused until the user taps play.
      return `<iframe src="https://www.tiktok.com/embed/v2/${videoId}?autoplay=0&music_info=1&description=1" style="border:none;width:100%;display:block;" allowfullscreen allow="encrypted-media; fullscreen" loading="lazy"></iframe>`;
    }
  } catch {
    // Fall through
  }
  return null;
};


export const UniversalMetaEmbed = ({ url, postId, suggestedHeight }: UniversalMetaEmbedProps) => {
  const cached = embedCache.get(url);

  const [embedHtml, setEmbedHtml] = useState<string | null>(cached?.embedHtml ?? null);
  const [fallbackData, setFallbackData] = useState<{ title?: string; image?: string; description?: string } | null>(
    cached?.fallbackData ?? null
  );
  const [expandedUrl, setExpandedUrl] = useState(cached?.expandedUrl ?? url);
  const [embedUrl, setEmbedUrl] = useState(cached?.embedUrl ?? url); // Separate URL for embedding
  const [showFallback, setShowFallback] = useState(cached?.showFallback ?? false);
  const lastTapRef = useRef<number>(0);

  // Detect URLs that REQUIRE async expansion before we can build a real embed.
  // While expansion is pending (and we couldn't build immediate HTML), we must
  // NOT render OgCardFallback — its `data-embed-status="ready"` tells the
  // parent skeleton to dismiss, causing a "View on TikTok / Facebook" flash.
  const needsAsyncExpansion = (() => {
    const lower = url.toLowerCase();
    return (
      lower.includes('vm.tiktok.com') ||
      lower.includes('vt.tiktok.com') ||
      (lower.includes('tiktok.com') && lower.includes('/t/')) ||
      lower.includes('fb.watch') ||
      lower.includes('fb.me') ||
      (lower.includes('facebook.com') && lower.includes('/share/'))
    );
  })();
  const expansionPending = needsAsyncExpansion && !cached && !embedHtml && !showFallback;

  const handleDoubleTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      void openExternalUrl(embedUrl);
    }

    lastTapRef.current = now;
  };

  useEffect(() => {
    // Instant first paint: build an embed immediately (no "Loading embed" flash).
    // Then enhance in background (expand URLs + fetch OG + cache result).
    const platform = detectPlatform(url);
    const immediateHtml =
      platform === 'instagram'
        ? buildInstagramEmbed(url)
        : platform === 'facebook'
          ? buildFacebookEmbed(url)
          : platform === 'spotify'
            ? buildSpotifyEmbed(url)
            : platform === 'linkedin'
              ? buildLinkedInEmbed(url)
              : platform === 'threads'
                ? buildThreadsEmbed(url)
                : platform === 'tiktok'
                  ? buildTikTokEmbed(url)
                  : null;

    if (immediateHtml && !showFallback) {
      setEmbedHtml(immediateHtml);
    }

    const processUrl = async () => {
      let finalUrl = url;
      let urlForEmbed = url;
      let shouldShowFallback = false;
      let computedHtml: string | null = null;

      try {
        // Step 1: Expand short URLs and Facebook share URLs
        const needsExpansion =
          url.includes('fb.watch') ||
          url.includes('fb.me') ||
          url.includes('bit.ly') ||
          url.includes('pin.it') ||
          url.includes('vm.tiktok.com') ||
          url.includes('vt.tiktok.com') ||
          (url.includes('tiktok.com') && url.includes('/t/')) ||
          (url.includes('facebook.com') && url.includes('/share/'));

        if (needsExpansion) {
          
          try {
            const { data: expandData, error: expandError } = await supabase.functions.invoke('expand-url', {
              body: { url },
            });

            if (!expandError && expandData?.finalUrl) {
              finalUrl = expandData.finalUrl;
              urlForEmbed = finalUrl;

              // A Facebook /login/?next=<post> expansion is still usable after
              // normalizeFacebookUrl extracts the real post URL. Only fallback
              // when there is no next= target to embed.
              if (finalUrl.includes('/login/') && platform === 'facebook') {
                try {
                  const fbLogin = new URL(finalUrl);
                  shouldShowFallback = !fbLogin.searchParams.get('next');
                } catch {
                  shouldShowFallback = true;
                }
              }

              if (expandData?.title?.toLowerCase().includes('log in to facebook')) {
                
                shouldShowFallback = true;
              }
            } else {
              console.warn('[UniversalMetaEmbed] Expansion failed, using original URL:', expandError);
              urlForEmbed = url;
            }
          } catch (err) {
            console.error('[UniversalMetaEmbed] Expansion error:', err);
            urlForEmbed = url;
          }
        }

        setExpandedUrl(finalUrl);
        setEmbedUrl(urlForEmbed);

        // Step 2: Fetch OG data for fallback (non-blocking)
        supabase.functions
          .invoke('fetch-og', {
            body: { url: finalUrl },
          })
          .then(({ data: ogData, error: ogError }) => {
            if (!ogError && ogData) {
              const ogTitle = ogData.meta?.title || ogData.title;

              // Check if the OG data indicates a login page
              if (ogTitle?.toLowerCase().includes('log in to facebook') && platform === 'facebook') {
                
                shouldShowFallback = true;
                setShowFallback(true);
              }

              setFallbackData({
                title: ogTitle,
                image: ogData.meta?.image || ogData.image,
                description: ogData.meta?.description || ogData.description,
              });
            }
          })
          .catch((err) => console.warn('[UniversalMetaEmbed] OG fetch failed:', err));

        // Step 3: Build embed HTML based on platform (skip if we should show fallback)
        computedHtml = null;
        if (!shouldShowFallback) {
          if (platform === 'instagram') {
            computedHtml = buildInstagramEmbed(urlForEmbed);
          } else if (platform === 'facebook') {
            computedHtml = buildFacebookEmbed(urlForEmbed);
          } else if (platform === 'spotify') {
            computedHtml = buildSpotifyEmbed(urlForEmbed);
          } else if (platform === 'linkedin') {
            computedHtml = buildLinkedInEmbed(urlForEmbed);
          } else if (platform === 'threads') {
            computedHtml = buildThreadsEmbed(urlForEmbed);
          } else if (platform === 'tiktok') {
            computedHtml = buildTikTokEmbed(urlForEmbed);
          }

          if (computedHtml) {
            setEmbedHtml(computedHtml);
          } else {
            shouldShowFallback = true;
            setShowFallback(true);
          }
        } else {
          setShowFallback(true);
        }
      } catch (error) {
        console.error('[UniversalMetaEmbed] Error processing URL:', error);
      }

      // Write computed values to cache (NOT stale state refs)
      const cacheEntry: CachedEmbed = {
        embedHtml: shouldShowFallback ? null : computedHtml ?? immediateHtml,
        fallbackData: null, // OG data arrives async and updates cache separately
        expandedUrl: finalUrl,
        embedUrl: urlForEmbed,
        showFallback: shouldShowFallback,
      };
      embedCache.set(url, cacheEntry);
    };

    // If we already have a cached resolved version, don't redo network work.
    if (!cached) {
      processUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (embedHtml && !showFallback) {
    // For direct iframe embeds (Spotify, Instagram, LinkedIn, Threads), render without RawEmbedRenderer
      const isDirectIframe = embedHtml.includes('open.spotify.com/embed') || (embedHtml.includes('instagram.com') && embedHtml.includes('<iframe')) || embedHtml.includes('linkedin.com/embed') || (embedHtml.includes('threads.net') && embedHtml.includes('<iframe')) || (embedHtml.includes('facebook.com/plugins/') && embedHtml.includes('<iframe')) || (embedHtml.includes('tiktok.com/embed') && embedHtml.includes('<iframe'));

      if (isDirectIframe) {
        const sanitizedHtml = DOMPurify.sanitize(embedHtml, {
          ALLOWED_TAGS: ['iframe'],
          ALLOWED_ATTR: ['src', 'style', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'loading', 'scrolling', 'title']
        });
      const isInstagramIframe = embedHtml.includes('instagram.com');
      const isThreadsIframe = embedHtml.includes('threads.net');
      const isFacebookIframe = embedHtml.includes('facebook.com/plugins/');
      const isLinkedInIframe = embedHtml.includes('linkedin.com/embed');
      const isTikTokIframe = embedHtml.includes('tiktok.com/embed');

      if (isFacebookIframe) {
        return (
          <FacebookIframeEmbed
            html={sanitizedHtml}
            expandedUrl={expandedUrl}
            fallbackData={fallbackData}
            postId={postId}
            suggestedHeight={suggestedHeight}
          />
        );
      }

      if (isLinkedInIframe) {
        const srcMatch = sanitizedHtml.match(/src="([^"]+)"/);
        const iframeSrc = srcMatch ? srcMatch[1] : '';
        return <LinkedInIframeEmbed src={iframeSrc} />;
      }

      if (isTikTokIframe) {
        const srcMatch = sanitizedHtml.match(/src="([^"]+)"/);
        const iframeSrc = srcMatch ? srcMatch[1] : '';
        return (
          <TikTokIframeEmbed
            src={iframeSrc}
            postId={postId}
            suggestedHeight={suggestedHeight}
          />
        );
      }

      if (isInstagramIframe) {
        const srcMatch = sanitizedHtml.match(/src="([^"]+)"/);
        const iframeSrc = srcMatch ? srcMatch[1] : '';
        return (
          <InstagramIframeEmbed
            src={iframeSrc}
            postId={postId}
            suggestedHeight={suggestedHeight}
            expandedUrl={expandedUrl}
          />
        );
      }

      // Threads iframe: render with onError fallback
      if (isThreadsIframe) {
        const srcMatch = sanitizedHtml.match(/src="([^"]+)"/);
        const iframeSrc = srcMatch ? srcMatch[1] : '';

        return (
          <ThreadsIframeEmbed
            src={iframeSrc}
            expandedUrl={expandedUrl}
            fallbackData={fallbackData}
            postId={postId}
            suggestedHeight={suggestedHeight}
          />
        );
      }

      return (
        <div
          className="relative w-full overflow-hidden [&>iframe]:w-full [&>iframe]:block"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      );
    }

    return (
      <div onClick={handleDoubleTap}>
        <RawEmbedRenderer
          embedHtml={embedHtml}
          onError={() => {
            
            setShowFallback(true);
          }}
        />
      </div>
    );
  }

  // Show fallback if no embed HTML or if embed failed
  const platform = detectPlatform(expandedUrl);

  // Suppress fallback while we're still waiting for URL expansion to resolve.
  // Returning a loading sentinel keeps the parent's skeleton in place so the
  // user never sees a "View on TikTok / Facebook" placeholder flash.
  if (expansionPending) {
    return <div data-embed-status="loading" className="w-full" style={{ minHeight: 1 }} />;
  }

  const platformName =
    platform === 'instagram' ? 'Instagram'
    : platform === 'facebook' ? 'Facebook'
    : platform === 'spotify' ? 'Spotify'
    : platform === 'reddit' ? 'Reddit'
    : platform === 'quora' ? 'Quora'
    : platform === 'medium' ? 'Medium'
    : platform === 'blog' ? 'Blog'
    : platform === 'threads' ? 'Threads'
    : platform === 'linkedin' ? 'LinkedIn'
    : platform === 'tiktok' ? 'TikTok'
    : 'Web';

  return (
    <div data-embed-status="ready">
      <OgCardFallback
        url={expandedUrl}
        title={fallbackData?.title}
        image={fallbackData?.image}
        description={fallbackData?.description}
        platform={platformName}
      />
    </div>
  );
};
