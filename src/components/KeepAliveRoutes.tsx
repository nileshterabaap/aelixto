import { ReactNode, useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { KeepAlive } from "./KeepAlive";
import { setScrollPosition } from "@/hooks/useScrollRestoration";

interface KeepAliveRoutesProps {
  /** Routes to keep alive (won't unmount) */
  keepAliveRoutes: {
    path: string;
    element: ReactNode;
  }[];
  /** Fallback content for non-keep-alive routes */
  children: ReactNode;
}

// Use a dedicated Map for keep-alive routes scroll positions
// This is separate from useScrollRestoration to avoid conflicts
const keepAliveScrollPositions = new Map<string, number>();

/**
 * Manages keep-alive routes alongside normal React Router routes.
 * Keep-alive routes stay mounted (hidden with display:none) while
 * other routes use normal React Router unmount behavior.
 */
export const KeepAliveRoutes = ({ keepAliveRoutes, children }: KeepAliveRoutesProps) => {
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Track which keep-alive routes have been visited (lazy mount)
  const [mountedRoutes, setMountedRoutes] = useState<Set<string>>(() => {
    // Initialize with current route if it's a keep-alive route
    const initial = new Set<string>();
    if (keepAliveRoutes.some(r => r.path === currentPath)) {
      initial.add(currentPath);
    }
    return initial;
  });
  
  // Check if current route is a keep-alive route
  const isKeepAliveRoute = useMemo(() => 
    keepAliveRoutes.some(r => r.path === currentPath),
    [keepAliveRoutes, currentPath]
  );
  
  // Mount keep-alive routes lazily when first visited
  useEffect(() => {
    if (isKeepAliveRoute && !mountedRoutes.has(currentPath)) {
      setMountedRoutes(prev => new Set(prev).add(currentPath));
    }
  }, [currentPath, isKeepAliveRoute, mountedRoutes]);
  
  // Track previous path for scroll save/restore
  const previousPath = useRef(currentPath);
  const isRestoringScroll = useRef(false);
  
  // Save scroll position continuously while on a keep-alive route
  useEffect(() => {
    if (!isKeepAliveRoute) return;
    
    const saveScroll = () => {
      if (!isRestoringScroll.current) {
        const pos = window.scrollY;
        keepAliveScrollPositions.set(currentPath, pos);
        // Also sync to the shared scroll system for BottomNav compatibility
        setScrollPosition(currentPath, pos);
      }
    };
    
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => window.removeEventListener('scroll', saveScroll);
  }, [currentPath, isKeepAliveRoute]);
  
  // Handle scroll save/restore on route change
  useLayoutEffect(() => {
    if (previousPath.current === currentPath) return;
    
    const wasKeepAlive = keepAliveRoutes.some(r => r.path === previousPath.current);
    
    // Save scroll position when LEAVING a keep-alive route
    if (wasKeepAlive) {
      // IMPORTANT: During navigation, browsers (and/or route transitions) can briefly
      // report scrollY=0. Never overwrite a good saved value with 0.
      const currentY = window.scrollY;
      const existing = keepAliveScrollPositions.get(previousPath.current) ?? 0;
      const next = currentY === 0 && existing > 0 ? existing : currentY;
      keepAliveScrollPositions.set(previousPath.current, next);
      setScrollPosition(previousPath.current, next);
    }
    
    // Restore scroll position when RETURNING to a keep-alive route
    if (isKeepAliveRoute) {
      const savedPosition = keepAliveScrollPositions.get(currentPath);
      
      if (savedPosition !== undefined && savedPosition > 0) {
        isRestoringScroll.current = true;
        
        // Use requestAnimationFrame for better timing with display:none toggle
        requestAnimationFrame(() => {
          window.scrollTo(0, savedPosition);
          
          // Multiple retry attempts with increasing delays
          const delays = [16, 32, 50, 100, 150, 250];
          delays.forEach((delay, index) => {
            setTimeout(() => {
              window.scrollTo(0, savedPosition);
              if (index === delays.length - 1) {
                isRestoringScroll.current = false;
              }
            }, delay);
          });
        });
      } else {
        // First visit - don't scroll to top, let the page render naturally
        // Only scroll to top if we're navigating here fresh
        if (!mountedRoutes.has(currentPath)) {
          window.scrollTo(0, 0);
        }
      }
    } else {
      // Entering a non-keep-alive route - scroll to top
      window.scrollTo(0, 0);
    }
    
    previousPath.current = currentPath;
  }, [currentPath, isKeepAliveRoute, keepAliveRoutes, mountedRoutes]);
  
  return (
    <>
      {/* Render all mounted keep-alive routes (hidden when not active) */}
      {keepAliveRoutes.map(route => {
        // Only render if this route has been visited
        if (!mountedRoutes.has(route.path)) return null;
        
        return (
          <KeepAlive
            key={route.path}
            route={route.path}
            currentRoute={currentPath}
          >
            {route.element}
          </KeepAlive>
        );
      })}
      
      {/* Render normal routes only when not on a keep-alive route */}
      {!isKeepAliveRoute && children}
    </>
  );
};
