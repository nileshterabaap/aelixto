import { useState, useEffect, useRef, useCallback } from 'react';
import { EmbedSkeleton } from '@/components/EmbedSkeleton';

const MIN_SKELETON_MS = 200;
const IFRAME_LOAD_TIMEOUT = 12000;

/**
 * Shared skeleton gate: shows a platform-aware skeleton for at least MIN_SKELETON_MS,
 * then fades smoothly into real content once it renders.
 *
 * KEY FIX: For iframes, we wait for the `load` event instead of just detecting
 * the element in the DOM. This prevents revealing blank/black boxes.
 */
export const SkeletonGate = ({
  platform,
  children,
}: {
  platform?: string;
  children: React.ReactNode;
}) => {
  const [ready, setReady] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const mountTime = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRetried = useRef(false);
  const handledIframes = useRef(new WeakSet<HTMLIFrameElement>());

  useEffect(() => {
    const remaining = MIN_SKELETON_MS - (Date.now() - mountTime.current);
    const timer = setTimeout(() => setMinElapsed(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, []);

  // Attach load/error handlers to iframes — only mark ready on load, not on DOM presence
  const attachIframeHandlers = useCallback((iframe: HTMLIFrameElement) => {
    if (handledIframes.current.has(iframe)) return;
    handledIframes.current.add(iframe);

    iframe.addEventListener('load', () => {
      setReady(true);
    });
    iframe.addEventListener('error', () => {
      if (!hasRetried.current) {
        hasRetried.current = true;
        setReady(false);
        setRetryKey(k => k + 1);
      } else {
        setReady(true); // give up, show whatever we have
      }
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const check = () => {
      // For iframes: attach load handlers but do NOT set ready yet
      const iframes = el.querySelectorAll('iframe');
      if (iframes.length > 0) {
        iframes.forEach(iframe => attachIframeHandlers(iframe as HTMLIFrameElement));
        // Don't return true — wait for load event
        return false;
      }

      // For non-iframe content (images, blockquotes, cards, etc.), ready immediately
      if (el.querySelector('img, .twitter-embed-container *, .embed-container *, [class*="rounded-xl"], [class*="og-card"]')) {
        setReady(true);
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver(() => { check(); });
    observer.observe(el, { childList: true, subtree: true });

    // Fallback: mark ready after timeout regardless
    const fallback = setTimeout(() => setReady(true), IFRAME_LOAD_TIMEOUT);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [retryKey, attachIframeHandlers]);

  const showContent = ready && minElapsed;

  return (
    <div className="relative w-full">
      <div
        className={`transition-opacity duration-300 ${showContent ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'}`}
      >
        <EmbedSkeleton platform={platform} />
      </div>
      <div
        ref={containerRef}
        key={retryKey}
        className={`transition-opacity duration-300 ${showContent ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}
      >
        {children}
      </div>
    </div>
  );
};
