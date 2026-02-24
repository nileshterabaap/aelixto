import { useState, useEffect, useRef, useCallback } from 'react';
import { EmbedSkeleton } from '@/components/EmbedSkeleton';

const MIN_SKELETON_MS = 200;
const IFRAME_LOAD_TIMEOUT = 12000; // 12s max wait for iframe content

/**
 * Shared skeleton gate: shows a platform-aware skeleton for at least MIN_SKELETON_MS,
 * then fades smoothly into real content once it renders (detected via MutationObserver).
 * Also detects failed/blank iframes and forces a retry.
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

  useEffect(() => {
    const remaining = MIN_SKELETON_MS - (Date.now() - mountTime.current);
    const timer = setTimeout(() => setMinElapsed(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, []);

  // Attach load/error handlers to iframes
  const attachIframeHandlers = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const iframes = el.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      if ((iframe as any).__skeletonHandled) return;
      (iframe as any).__skeletonHandled = true;
      
      iframe.addEventListener('load', () => {
        setReady(true);
      });
      iframe.addEventListener('error', () => {
        if (!hasRetried.current) {
          hasRetried.current = true;
          setReady(false);
          setRetryKey(k => k + 1);
        } else {
          setReady(true);
        }
      });
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const check = () => {
      if (el.querySelector('iframe, img, .twitter-embed-container *, .pinterest-embed-container *, .embed-container *')) {
        setReady(true);
        attachIframeHandlers();
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
