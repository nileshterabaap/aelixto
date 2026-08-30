import { useState, useEffect, useRef } from 'react';
import { OgCardFallback } from '@/components/OgCardFallback';
import { usePersistEmbedHeight } from '@/hooks/usePersistEmbedHeight';
import { trackView } from '@/hooks/useViewTracking';
import { EMBED_FADE_MS, EmbedFadeSkeleton, useSmoothReveal } from '@/components/embeds/SmoothEmbedFrame';

// One-shot guard so a Threads post never records more than one video_play per
// session from this path (the guarded tracker may also fire; the server's
// unique index on (post_id, viewer, event_type) dedupes any overlap).
const threadsPlayFired = new Set<string>();

/**
 * Threads-only embed. Extracted out of UniversalMetaEmbed so Threads fixes
 * never touch the Facebook/Instagram guarded baseline.
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

    const atTop = () => window.scrollY <= 2;
    let suppressed = false;

    const arm = () => { el.style.pointerEvents = 'auto'; };
    const disarm = () => { el.style.pointerEvents = 'none'; };
    const sync = () => {
      if (suppressed) { disarm(); return; }
      // Only ever armed to let Pull-to-Refresh observe a touch at scroll-top.
      // It is NOT armed for scoring: the guarded tracker already owns the
      // one-shot Threads video_play, so taps elsewhere (grid, scrolled feed)
      // reach the native player on the very first tap.
      if (atTop()) arm();
      else disarm();
    };

    const onStart = () => {
      // Hand the tap straight back to the native player.
      suppressed = true;
      disarm();
      if (postId && !threadsPlayFired.has(postId)) {
        threadsPlayFired.add(postId);
        trackView({ postId, eventType: 'video_play' }).catch(() => {
          threadsPlayFired.delete(postId);
        });
      }
    };

    const onScroll = () => {
      suppressed = false;
      sync();
    };

    sync();
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('pointerdown', onStart, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('pointerdown', onStart);
      window.removeEventListener('scroll', onScroll);
    };
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
      className="relative w-full overflow-hidden"
      style={{ width: '100%', height: `${height}px`, minHeight: `${THREADS_MIN_HEIGHT}px` }}
    >
      <EmbedFadeSkeleton visible={!threadsRevealed} />
      <div
        ref={catcherRef}
        data-threads-ptr-catcher="1"
        data-threads-play-capture="1"
        className="threads-ptr-catcher"
        aria-hidden="true"
      />
      <iframe
        ref={iframeRef}
        src={src}
        scrolling="no"
        allowFullScreen
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        data-nav-lock-applied="1"
        onLoad={() => {
          setHasLoaded(true);
        }}
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          margin: 0,
          padding: 0,
          background: 'transparent',
          position: 'relative',
          zIndex: 1,
          opacity: threadsRevealed ? 1 : 0,
          transition: `opacity ${EMBED_FADE_MS}ms ease`,
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
}: {
  url: string;
  postId?: string | null;
  suggestedHeight?: number | null;
}) => {
  const src = buildThreadsEmbedSrc(url);
  if (!src) return <OgCardFallback url={url} platform="Threads" />;
  return (
    <ThreadsIframeEmbed
      src={src}
      postId={postId}
      suggestedHeight={suggestedHeight}
    />
  );
};
