import { useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useScrollVelocity } from '@/hooks/useScrollVelocity';

interface LazyEmbedProps {
  children: ReactNode;
  thumbnailUrl?: string | null;
  previewTitle?: string | null;
  previewText?: string | null;
  platform?: string;
  mediaUrl?: string | null;
  autoLoad?: boolean;
}

export const LazyEmbed = ({
  children,
  autoLoad = false
}: LazyEmbedProps) => {
  const [shouldLoad, setShouldLoad] = useState(autoLoad);
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

  // Base intersection observer for normal loading
  useEffect(() => {
    if (!containerRef.current || autoLoad || shouldLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
          }
        });
      },
      {
        rootMargin: '2000px', // Base preload distance
        threshold: 0.01
      }
    );

    observer.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [autoLoad, shouldLoad]);

  // Additional check when scrolling fast - extend preload range
  useEffect(() => {
    if (!isScrollingFast || shouldLoad) return;
    checkShouldLoad();
  }, [isScrollingFast, velocity, checkShouldLoad, shouldLoad]);

  return (
    <div ref={containerRef}>
      {shouldLoad && children}
    </div>
  );
};
