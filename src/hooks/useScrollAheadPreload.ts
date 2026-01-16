import { useEffect, useRef, useCallback } from 'react';
import { preloadNextBatch } from '@/lib/preloadImages';

interface Post {
  profiles?: { avatar_url?: string | null };
  thumbnail_url?: string | null;
  media_url?: string | null;
}

// Preload images for posts that are about to scroll into view
export const useScrollAheadPreload = (
  posts: Post[],
  options: {
    preloadCount?: number; // How many posts ahead to preload
    triggerThreshold?: number; // How many posts from the end to trigger preload
  } = {}
) => {
  const { preloadCount = 5, triggerThreshold = 3 } = options;
  const lastPreloadedIndex = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const triggerRefs = useRef<Map<number, HTMLElement>>(new Map());

  // Preload when a trigger element becomes visible
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const index = parseInt(entry.target.getAttribute('data-preload-index') || '0', 10);
        
        // Calculate which posts to preload (ones that haven't been preloaded yet)
        const startIndex = Math.max(index + 1, lastPreloadedIndex.current);
        
        if (startIndex < posts.length && startIndex > lastPreloadedIndex.current) {
          preloadNextBatch(posts, startIndex, preloadCount);
          lastPreloadedIndex.current = startIndex + preloadCount;
        }
      }
    });
  }, [posts, preloadCount]);

  // Setup intersection observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin: '200px 0px', // Start preloading 200px before element enters viewport
      threshold: 0,
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [handleIntersection]);

  // Register a trigger element at a specific index
  const registerTrigger = useCallback((index: number, element: HTMLElement | null) => {
    const observer = observerRef.current;
    if (!observer) return;

    // Only observe elements near threshold positions
    const shouldObserve = (index + triggerThreshold) % preloadCount === 0;
    if (!shouldObserve) return;

    const existingElement = triggerRefs.current.get(index);
    
    if (existingElement && existingElement !== element) {
      observer.unobserve(existingElement);
      triggerRefs.current.delete(index);
    }

    if (element) {
      element.setAttribute('data-preload-index', String(index));
      observer.observe(element);
      triggerRefs.current.set(index, element);
    }
  }, [triggerThreshold, preloadCount]);

  // Reset when posts change significantly
  useEffect(() => {
    if (posts.length === 0) {
      lastPreloadedIndex.current = 0;
    }
  }, [posts.length]);

  return { registerTrigger };
};
