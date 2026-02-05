import { useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useScrollVelocity } from '@/hooks/useScrollVelocity';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [isVisible, setIsVisible] = useState(autoLoad);
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

  // Visibility observer - tight margin for auto-pause when off-screen
  useEffect(() => {
    if (!containerRef.current || autoLoad) return;

    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Only toggle visibility if content is loaded
          if (shouldLoad) {
            setIsVisible(entry.isIntersecting);
          }
        });
      },
      {
        rootMargin: '100px', // Small margin - unmount shortly after leaving viewport
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

  // Placeholder to maintain layout when content is unloaded
  const minHeight = shouldLoad && !isVisible ? '300px' : undefined;

  return (
    <div ref={containerRef} style={{ minHeight }}>
      <AnimatePresence mode="wait">
        {shouldLoad && isVisible && (
          <motion.div
            key="embed-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
