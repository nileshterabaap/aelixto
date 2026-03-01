import { useState, useEffect, useRef, useCallback } from 'react';
import { EmbedSkeleton } from '@/components/EmbedSkeleton';

const MIN_SKELETON_MS = 150;
const IFRAME_LOAD_TIMEOUT = 3000;

// Module-level cache: once an embed in a post has loaded, never show skeleton again
const readyCache = new Set<string>();

/**
 * Shows a platform-aware skeleton while embed content loads,
 * then crossfades smoothly into real content.
 * 
 * Uses a global readyCache so scrolling back to already-loaded posts
 * never flashes a skeleton.
 */
export const SkeletonGate = ({
  platform,
  children,
  cacheKey,
}: {
  platform?: string;
  children: React.ReactNode;
  /** Unique key (e.g. post ID) to remember ready state across re-mounts */
  cacheKey?: string;
}) => {
  const wasCached = cacheKey ? readyCache.has(cacheKey) : false;
  const [ready, setReady] = useState(wasCached);
  const [minElapsed, setMinElapsed] = useState(wasCached);
  const mountTime = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const handledIframes = useRef(new WeakSet<HTMLIFrameElement>());

  useEffect(() => {
    if (wasCached) return; // Skip timer if already cached
    const remaining = MIN_SKELETON_MS - (Date.now() - mountTime.current);
    const timer = setTimeout(() => setMinElapsed(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [wasCached]);

  const markReady = useCallback(() => {
    setReady(true);
    if (cacheKey) readyCache.add(cacheKey);
  }, [cacheKey]);

  // Attach load handler + per-iframe safety timeout
  const attachIframeHandlers = useCallback((iframe: HTMLIFrameElement) => {
    if (handledIframes.current.has(iframe)) return;
    handledIframes.current.add(iframe);

    iframe.addEventListener('load', markReady);
    iframe.addEventListener('error', markReady);

    // Per-iframe safety: if load doesn't fire within 2s, reveal anyway
    setTimeout(markReady, 2000);
  }, [markReady]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Platforms that use SDK to replace blockquote → iframe (must wait for iframe)
    const needsIframe = platform === 'instagram' || platform === 'facebook' || platform === 'threads';

    const check = () => {
      const iframes = el.querySelectorAll('iframe');
      if (iframes.length > 0) {
        iframes.forEach(iframe => attachIframeHandlers(iframe as HTMLIFrameElement));
        return false; // wait for load or per-iframe timeout
      }

      // For SDK-based embeds, don't mark ready until iframe appears
      if (needsIframe) return false;

      // Non-iframe content: any visible child means ready
      if (el.children.length > 0 && el.querySelector('img, video, div, [class*="card"], [class*="rounded"]')) {
        markReady();
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver(() => { check(); });
    observer.observe(el, { childList: true, subtree: true });

    // Global fallback
    const fallback = setTimeout(markReady, IFRAME_LOAD_TIMEOUT);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [attachIframeHandlers, markReady]);

  const showContent = ready && minElapsed;

  return (
    <div className="relative w-full">
      {/* Skeleton layer */}
      <div
        className="transition-all duration-500 ease-out"
        style={{
          opacity: showContent ? 0 : 1,
          transform: showContent ? 'scale(0.97)' : 'scale(1)',
          position: showContent ? 'absolute' : 'relative',
          inset: showContent ? 0 : undefined,
          pointerEvents: showContent ? 'none' : 'auto',
        }}
      >
        <EmbedSkeleton platform={platform} />
      </div>

      {/* Real content layer */}
      <div
        ref={containerRef}
        className="transition-all duration-500 ease-out"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'scale(1)' : 'scale(1.01)',
          height: showContent ? 'auto' : 0,
          overflow: showContent ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
};
