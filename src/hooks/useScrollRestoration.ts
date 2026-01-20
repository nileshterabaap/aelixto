import { useEffect, useRef, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Store scroll positions for each route - persisted across component lifecycles
const scrollPositions = new Map<string, number>();

// Debug logging
const DEBUG = false;
const log = (...args: unknown[]) => DEBUG && console.log('[ScrollRestoration]', ...args);

export const useScrollRestoration = (key?: string) => {
  const location = useLocation();
  const routeKey = key || location.pathname;
  const isRestoring = useRef(false);
  const mounted = useRef(false);
  
  // Save scroll position continuously
  useEffect(() => {
    mounted.current = true;
    
    const saveScrollPosition = () => {
      if (!isRestoring.current && mounted.current) {
        const pos = window.scrollY;
        scrollPositions.set(routeKey, pos);
        log('Saved position:', routeKey, pos);
      }
    };

    window.addEventListener('scroll', saveScrollPosition, { passive: true });
    
    return () => {
      mounted.current = false;
      window.removeEventListener('scroll', saveScrollPosition);
      // Save final position
      if (!isRestoring.current) {
        scrollPositions.set(routeKey, window.scrollY);
        log('Saved on unmount:', routeKey, window.scrollY);
      }
    };
  }, [routeKey]);

  // Restore scroll position after render
  useLayoutEffect(() => {
    const savedPosition = scrollPositions.get(routeKey);
    log('Attempting restore:', routeKey, 'saved:', savedPosition);
    
    if (savedPosition !== undefined && savedPosition > 0) {
      isRestoring.current = true;
      
      // Prevent browser's automatic scroll reset
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
      
      // Multiple attempts to ensure content is loaded
      const restore = () => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const targetPos = Math.min(savedPosition, maxScroll);
        
        if (maxScroll >= savedPosition || maxScroll > 100) {
          window.scrollTo(0, targetPos);
          log('Restored to:', targetPos, 'maxScroll:', maxScroll);
          isRestoring.current = false;
          return true;
        }
        return false;
      };
      
      // Try immediately
      if (!restore()) {
        // Retry with increasing delays
        const delays = [10, 50, 100, 200, 300];
        delays.forEach((delay, i) => {
          setTimeout(() => {
            if (isRestoring.current) {
              restore();
            }
          }, delay);
        });
        
        // Final fallback
        setTimeout(() => {
          isRestoring.current = false;
        }, 500);
      }
    }
  }, [routeKey]);

  const clearScrollPosition = () => {
    scrollPositions.delete(routeKey);
    log('Cleared:', routeKey);
  };

  return { clearScrollPosition };
};

export const clearAllScrollPositions = () => {
  scrollPositions.clear();
};
