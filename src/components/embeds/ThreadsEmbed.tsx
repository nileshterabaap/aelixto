import { useState, useEffect, useRef } from 'react';
import { OgCardFallback } from '@/components/OgCardFallback';
import { usePersistEmbedHeight } from '@/hooks/usePersistEmbedHeight';
import { trackView } from '@/hooks/useViewTracking';
import { EMBED_FADE_MS, useSmoothReveal } from '@/components/embeds/SmoothEmbedFrame';
import { markOriginalVisit } from '@/hooks/useOriginalVisitTracker';
import { openExternalUrl } from '@/lib/openExternalUrl';
import {
  fetchThreadsVideoMeta,
  getCachedThreadsVideoMeta,
  type ThreadsVideoMeta,
} from '@/lib/threadsVideoMeta';

// One-shot guard so a Threads post never records more than one video_play per
// session from this path (the guarded tracker may also fire; the server's
// unique index on (post_id, viewer, event_type) dedupes any overlap).
const threadsPlayFired = new Set<string>();

/**
 * Threads-only embed. Extracted out of UniversalMetaEmbed so Threads fixes
 * never touch the Facebook/Instagram guarded baseline.
 *
 * Threads VIDEO posts ALWAYS render the Aelixto-owned poster card (never the
 * /embed iframe) because the Threads player shows a black cover in Android
 * WebView. Image/text Threads posts keep the iframe.
 */

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
  postId,
  suggestedHeight,
}: {
  src: string;
  postId?: string | null;
  suggestedHeight?: number | null;
}) => {
  const [height, setHeight] = useState(() =>
    suggestedHeight && suggestedHeight >= THREADS_MIN_HEIGHT
      ? Math.min(THREADS_MAX_HEIGHT, suggestedHeight)
      : THREADS_DEFAULT_HEIGHT
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const persistHeight = usePersistEmbedHeight(postId);
  const catcherRef = useRef<HTMLDivElement>(null);

  // Single transparent capture layer that owns BOTH jobs:
  //  1. one-shot video_play capture (scoring), and
  //  2. letting Pull-to-Refresh observe a touch that would otherwise be
  //     swallowed by the cross-origin Threads iframe.
  // Two stacked layers used to each eat a tap and re-arm on a timer, which is
  // why taps needed 6-7 tries. This layer is armed only while it still has a
  // job to do (play not yet recorded, or the page is at scroll-top), consumes
  // exactly one touch, and does not re-arm until the user actually scrolls.
  useEffect(() => {
    const el = catcherRef.current;
    if (!el) return;

    const disarm = () => { el.style.pointerEvents = 'none'; };

    const onStart = () => {
      disarm();
      if (postId && !threadsPlayFired.has(postId)) {
        threadsPlayFired.add(postId);
        trackView({ postId, eventType: 'video_play' }).catch(() => {
          threadsPlayFired.delete(postId);
        });
      }
    };

    // The layer is permanently disarmed: the guarded tracker owns the one-shot
    // video_play, so the very first tap must reach the native Threads player.
    disarm();
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('pointerdown', onStart, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('pointerdown', onStart);
    };
  }, [postId]);

  // Regression fix: the capture layer is permanently disarmed (so the first
  // tap reaches the native player), which means no parent-side pointer event
  // exists for a cross-origin Threads tap. Tapping the iframe still moves
  // focus into it, blurring the window. Detect exactly that — window blur
  // while the page stays visible AND this post's iframe is the active
  // element — and record the one-shot video_play. Server dedupes overlap.
  useEffect(() => {
    if (!postId) return;
    const onBlur = () => {
      if (threadsPlayFired.has(postId)) return;
      setTimeout(() => {
        if (threadsPlayFired.has(postId)) return;
        if (document.visibilityState === 'hidden') return;
        if (document.activeElement !== iframeRef.current) return;
        threadsPlayFired.add(postId);
        trackView({ postId, eventType: 'video_play' }).catch(() => {
          threadsPlayFired.delete(postId);
        });
      }, 80);
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [postId]);

  // Pinterest-style smooth reveal (presentational only — the overlay below
  // stays at z-index 2 and keeps owning the first-tap video_play).
  const threadsRevealed = useSmoothReveal(hasLoaded);

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
    const el = wrapperRef.current;
    if (!el || isVisible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      style={{ width: '100%', height: `${height}px`, minHeight: `${THREADS_MIN_HEIGHT}px` }}
    >
      {/* Root-cause fix (WebView tile-memory / video-overlay promotion):
          the iframe itself must carry NO compositing property (opacity /
          transition / z-index) and no clipping ancestor, otherwise Chromium
          cannot promote the Threads video to an overlay surface and has to
          raster it into parent tiles — which fails in Android WebView's small
          tile budget and shows as a grey/black cover. The fade now lives on
          the skeleton above the iframe instead. */}
      <div
        aria-hidden
        className="absolute inset-0 animate-pulse rounded-lg bg-muted"
        style={{
          zIndex: 1,
          pointerEvents: 'none',
          opacity: threadsRevealed ? 0 : 1,
          transition: `opacity ${EMBED_FADE_MS}ms ease`,
          visibility: threadsRevealed ? 'hidden' : 'visible',
          transitionProperty: 'opacity, visibility',
        }}
      />
      {/* DIAGNOSTIC: catcher layer removed from the Threads tree so nothing at
          all can sit above the iframe and absorb the first tap. Tracking is
          unchanged — the window-blur one-shot below still records video_play. */}
      <div ref={catcherRef} style={{ display: 'none' }} aria-hidden="true" />
      <iframe
        ref={iframeRef}
        src={src}
        scrolling="no"
        allowFullScreen
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        loading="eager"
        data-nav-lock-applied="1"
        onLoad={() => {
          setHasLoaded(true);
        }}
        style={{
          border: 0,
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

export const isThreadsUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return /(^|\.)threads\.(net|com)$/.test(u.hostname);
  } catch {
    return false;
  }
};

export const buildThreadsEmbedSrc = (url: string): string | null => {
  try {
    const u = new URL(url);
    const postMatch = u.pathname.match(/\/@([^/]+)\/post\/([A-Za-z0-9_-]+)/);
    if (postMatch) {
      return `https://www.threads.net/@${postMatch[1]}/post/${postMatch[2]}/embed`;
    }
  } catch {
    // ignore
  }
  return null;
};

export const ThreadsEmbed = ({
  url,
  postId,
  suggestedHeight,
  thumbnailUrl,
}: {
  url: string;
  postId?: string | null;
  suggestedHeight?: number | null;
  thumbnailUrl?: string | null;
}) => {
  const src = buildThreadsEmbedSrc(url);
  const [meta, setMeta] = useState<ThreadsVideoMeta | null>(() => getCachedThreadsVideoMeta(url));

  useEffect(() => {
    if (meta) return;
    let cancelled = false;
    fetchThreadsVideoMeta(url).then((next) => {
      if (!cancelled) setMeta(next);
    });
    return () => {
      cancelled = true;
    };
  }, [url, meta]);

  if (!src) return <OgCardFallback url={url} platform="Threads" />;

  const posterImage = thumbnailUrl || meta?.image || null;

  // Threads VIDEO posts: ALWAYS render the Aelixto-owned poster card and NEVER
  // the /embed iframe (the Threads player shows a black cover in Android
  // WebView). If the video is detected but the cover image is not yet
  // available, hold a placeholder so the iframe player never flashes.
  if (meta?.hasVideo) {
    if (!posterImage) {
      return (
        <div
          aria-hidden
          className="w-full animate-pulse rounded-lg bg-muted"
          style={{ minHeight: THREADS_MIN_HEIGHT }}
        />
      );
    }
    const height =
      suggestedHeight && suggestedHeight >= THREADS_MIN_HEIGHT
        ? Math.min(THREADS_MAX_HEIGHT, suggestedHeight)
        : 420;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (postId) markOriginalVisit(postId);
          void openExternalUrl(url);
        }}
        aria-label="Open video on Threads"
        className="relative block w-full overflow-hidden rounded-lg"
        style={{ width: '100%', height: `${height}px`, minHeight: `${THREADS_MIN_HEIGHT}px` }}
      >
        <img
          src={posterImage}
          alt="Threads video"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <span className="absolute inset-0 bg-black/20 active:bg-black/30 transition-colors" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center justify-center w-14 h-14 rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-0.5" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </button>
    );
  }

  // Metadata still unknown: hold a neutral placeholder so a Threads video
  // never flashes its black player before the poster card takes over.
  if (!meta) {
    return (
      <div
        aria-hidden
        className="w-full animate-pulse rounded-lg bg-muted"
        style={{ minHeight: THREADS_MIN_HEIGHT }}
      />
    );
  }

  // Image/text Threads posts: render the /embed iframe.
  return (
    <ThreadsIframeEmbed
      src={src}
      postId={postId}
      suggestedHeight={suggestedHeight}
    />
  );
};
