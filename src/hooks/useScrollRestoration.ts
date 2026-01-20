import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Store scroll positions for each route
const scrollPositions = new Map<string, number>();

export const useScrollRestoration = (key?: string) => {
  const location = useLocation();
  const routeKey = key || location.pathname;
  const isRestoring = useRef(false);
  
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

  // Restore scroll position on mount
  useEffect(() => {
    const savedPosition = scrollPositions.get(routeKey);
    if (savedPosition !== undefined && savedPosition > 0) {
      isRestoring.current = true;
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPosition);
        // Reset flag after a short delay to allow scroll event to fire
        setTimeout(() => {
          isRestoring.current = false;
        }, 100);
      });
    }
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
