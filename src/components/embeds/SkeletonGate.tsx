import { useState, useEffect, useRef } from 'react';
import { EmbedSkeleton } from '@/components/EmbedSkeleton';

const MIN_SKELETON_MS = 200;

/**
 * Shared skeleton gate: shows a platform-aware skeleton for at least MIN_SKELETON_MS,
 * then fades smoothly into real content once it renders (detected via MutationObserver).
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
  const mountTime = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const remaining = MIN_SKELETON_MS - (Date.now() - mountTime.current);
    const timer = setTimeout(() => setMinElapsed(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const check = () => {
      if (el.querySelector('iframe, img, .twitter-embed-container *, .pinterest-embed-container *, .embed-container *')) {
        setReady(true);
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver(() => { check(); });
    observer.observe(el, { childList: true, subtree: true });

    // Fallback: mark ready after 5s regardless
    const fallback = setTimeout(() => setReady(true), 5000);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

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
        className={`transition-opacity duration-300 ${showContent ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}
      >
        {children}
      </div>
    </div>
  );
};
