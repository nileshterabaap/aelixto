import { useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useScrollVelocity } from '@/hooks/useScrollVelocity';
import { EmbedSkeleton } from '@/components/EmbedSkeleton';

interface LazyEmbedProps {
  children: ReactNode;
  thumbnailUrl?: string | null;
  previewTitle?: string | null;
  previewText?: string | null;
  platform?: string;
  mediaUrl?: string | null;
  autoLoad?: boolean;
}

const MIN_SKELETON_MS = 200;

/**
 * SkeletonGate: shows a platform-aware skeleton for at least MIN_SKELETON_MS,
 * then fades smoothly into real content once it renders (detected via MutationObserver).
 */
const SkeletonGate = ({
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
      {/* Skeleton layer */}
      <div
        className={`transition-opacity duration-300 ${showContent ? 'opacity-0 pointer-events-none absolute inset-0' : 'opacity-100'}`}
      >
        <EmbedSkeleton platform={platform} />
      </div>
      {/* Content layer - always mounted so embeds can initialize */}
      <div
        ref={containerRef}
        className={`transition-opacity duration-300 ${showContent ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}
      >
        {children}
      </div>
    </div>
  );
};

export const LazyEmbed = ({
  children,
  platform,
  autoLoad = false
}: LazyEmbedProps) => {
  const [shouldLoad, setShouldLoad] = useState(autoLoad);
  const [isNearViewport, setIsNearViewport] = useState(autoLoad);
  const containerRef = useRef<HTMLDivElement>(null);
  const { velocity, isScrollingFast } = useScrollVelocity();
  
  // Calculate adaptive preload distance based on scroll speed
  // Normal: 2000px (~5-6 posts), Fast: up to 5000px (~12-15 posts)
  const getPreloadDistance = useCallback(() => {
    if (isScrollingFast) {
      return Math.min(2000 + velocity * 2, 5000);
    }
    return 2000;
  }, [velocity, isScrollingFast]);

  // Check if element is within preload range
  const checkShouldLoad = useCallback(() => {
    if (!containerRef.current || shouldLoad) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const preloadDistance = getPreloadDistance();
    const viewportHeight = window.innerHeight;
    
    // Element is within preload distance from viewport
    if (rect.top < viewportHeight + preloadDistance && rect.bottom > -preloadDistance) {
      setShouldLoad(true);
    }
  }, [shouldLoad, getPreloadDistance]);

  // Preload observer - large margin for early loading
  useEffect(() => {
    if (!containerRef.current || autoLoad || shouldLoad) return;

    const preloadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
          }
        });
      },
      {
        rootMargin: '2000px', // Large margin for preloading
        threshold: 0.01
      }
    );

    preloadObserver.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        preloadObserver.unobserve(containerRef.current);
      }
    };
  }, [autoLoad, shouldLoad]);

  // Visibility observer - tracks if content is near viewport
  useEffect(() => {
    if (!containerRef.current || autoLoad) return;

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (shouldLoad) {
            setIsNearViewport(entry.isIntersecting);
          }
        });
      },
      {
        rootMargin: '500px',
        threshold: 0
      }
    );

    visibilityObserver.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        visibilityObserver.unobserve(containerRef.current);
      }
    };
  }, [autoLoad, shouldLoad]);

  // Additional check when scrolling fast - extend preload range
  useEffect(() => {
    if (!isScrollingFast || shouldLoad) return;
    checkShouldLoad();
  }, [isScrollingFast, velocity, checkShouldLoad, shouldLoad]);

  // CRITICAL FIX: Never unmount content once loaded!
  // Content stays in DOM, wrapped in SkeletonGate for smooth fade-in.
  return (
    <div ref={containerRef}>
      {shouldLoad && (
        <SkeletonGate platform={platform}>
          {children}
        </SkeletonGate>
      )}
    </div>
  );
};
