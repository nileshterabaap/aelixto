import { useEffect, useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Store scroll positions for each route
const scrollPositions = new Map<string, number>();

export const useScrollRestoration = (key?: string) => {
  const location = useLocation();
  const routeKey = key || location.pathname;
  const isRestoring = useRef(false);
  const hasRestored = useRef(false);
  
  // Save scroll position on unmount or route change
  useEffect(() => {
    const saveScrollPosition = () => {
      if (!isRestoring.current) {
        scrollPositions.set(routeKey, window.scrollY);
      }
    };

    // Save on scroll (debounced via passive listener)
    window.addEventListener('scroll', saveScrollPosition, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', saveScrollPosition);
      // Save final position on unmount
      saveScrollPosition();
    };
  }, [routeKey]);

  // Restore scroll position - use layoutEffect for synchronous restoration
  useLayoutEffect(() => {
    const savedPosition = scrollPositions.get(routeKey);
    
    if (savedPosition !== undefined && savedPosition > 0 && !hasRestored.current) {
      isRestoring.current = true;
      hasRestored.current = true;
      
      // Try immediate restoration first
      window.scrollTo(0, savedPosition);
      
      // If page height isn't ready yet, retry after content loads
      const attemptRestore = (attempts = 0) => {
        if (attempts > 10) {
          isRestoring.current = false;
          return;
        }
        
        // Check if we can actually scroll to that position
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (savedPosition <= maxScroll) {
          window.scrollTo(0, savedPosition);
          setTimeout(() => {
            isRestoring.current = false;
          }, 50);
        } else {
          // Content not loaded yet, retry
          requestAnimationFrame(() => attemptRestore(attempts + 1));
        }
      };
      
      // Give initial render time, then verify
      requestAnimationFrame(() => attemptRestore(0));
    }
    
    // Reset hasRestored when route changes
    return () => {
      hasRestored.current = false;
    };
  }, [routeKey]);

  // Clear a specific route's scroll position (for manual refresh)
  const clearScrollPosition = () => {
    scrollPositions.delete(routeKey);
  };

  return { clearScrollPosition };
};

// Export for manual position clearing (e.g., pull-to-refresh)
export const clearAllScrollPositions = () => {
  scrollPositions.clear();
};
