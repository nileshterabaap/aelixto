import { useState, useEffect, useRef } from 'react';
import { OgCardFallback } from '@/components/OgCardFallback';
import { usePersistEmbedHeight } from '@/hooks/usePersistEmbedHeight';
import { trackView } from '@/hooks/useViewTracking';

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Newly mounted Threads embeds (e.g. a post published on another route and
  // then surfaced by a feed refresh) can mount while the container is still
  // offscreen or hidden. With loading="lazy" the iframe never fires `load`,
  // so the old unconditional 6s timer flipped them to the "View on Threads"
  // card permanently — which also removed the iframe the nav-lock sandbox and
  // the one-shot play capture attach to. The timer now only runs while the
  // embed is actually visible, and we retry once before giving up.
  const [isVisible, setIsVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const persistHeight = usePersistEmbedHeight(postId);

  // Self-contained one-shot play capture (historical overlay behavior).
  // A tap that lands on a cross-origin iframe is delivered to the iframe's
  // own document — the parent never sees touchstart/pointerdown — so an
  // ancestor listener on the wrapper can never observe the first tap. The
  // capture must therefore be a real hit-target element stacked ABOVE the
  // iframe. It is fully transparent, fires video_play exactly once, then
  // disables pointer-events and removes itself synchronously so the same
  // tap sequence continues through to the native Threads Play button.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !postId || !isVisible) return;
    if (threadsPlayFired.has(postId)) return;
    if (wrapper.querySelector('[data-threads-play-capture="1"]')) return;

    const overlay = document.createElement('div');
    overlay.dataset.threadsPlayCapture = '1';
    overlay.style.cssText =
      'position:absolute;inset:0;z-index:2;background:transparent;pointer-events:auto;';

    let consumed = false;
    const consume = () => {
      if (consumed) return;
      consumed = true;
      overlay.style.pointerEvents = 'none';
      overlay.remove();
      if (threadsPlayFired.has(postId)) return;
      threadsPlayFired.add(postId);
      trackView({ postId, eventType: 'video_play' }).catch(() => {
        threadsPlayFired.delete(postId);
      });
    };

    const opts: AddEventListenerOptions = { capture: true, passive: true };
    overlay.addEventListener('touchstart', consume, opts);
    overlay.addEventListener('pointerdown', consume, opts);
    overlay.addEventListener('mousedown', consume, opts);
    overlay.addEventListener('click', consume, { capture: true });

    wrapper.appendChild(overlay);

    return () => {
      overlay.removeEventListener('touchstart', consume, opts);
      overlay.removeEventListener('pointerdown', consume, opts);
      overlay.removeEventListener('mousedown', consume, opts);
      overlay.removeEventListener('click', consume, { capture: true });
      if (overlay.isConnected) overlay.remove();
    };
  }, [postId, isVisible, attempt]);

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

  useEffect(() => {
    if (hasLoaded || !isVisible) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const timeout = setTimeout(() => {
      if (hasLoaded) return;
      if (attempt < 1) {
        // Remount the iframe once — covers embeds whose first request was
        // started while the tab/route was hidden and silently dropped.
        setAttempt((prev) => prev + 1);
      } else {
        setFailed(true);
      }
    }, 6000);

    return () => clearTimeout(timeout);
  }, [hasLoaded, isVisible, attempt]);

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
      ref={wrapperRef}
      className="relative w-full overflow-hidden"
      style={{ width: '100%', height: `${height}px`, minHeight: `${THREADS_MIN_HEIGHT}px` }}
    >
      {isVisible && (
        <iframe
          key={attempt}
          ref={iframeRef}
          src={src}
          scrolling="no"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          data-nav-lock-applied="1"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"
          loading="lazy"
          onLoad={() => {
            setHasLoaded(true);
            setFailed(false);
          }}
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
      )}
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
      return `https://www.threads.net${u.pathname.replace(/\/$/, '')}/embed`;
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
      expandedUrl={url}
      fallbackData={null}
      postId={postId}
      suggestedHeight={suggestedHeight}
    />
  );
};
