import { ReactNode, useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { KeepAlive } from "./KeepAlive";
import { setScrollPosition } from "@/hooks/useScrollRestoration";

interface KeepAliveRoute {
  /** Route pattern (supports dynamic segments like /u/:username) */
  pattern: string;
  /** Function to render the element for a given path */
  element: (path: string) => ReactNode;
}

interface KeepAliveRoutesProps {
  /** Routes to keep alive (won't unmount) */
  keepAliveRoutes: KeepAliveRoute[];
  /** Fallback content for non-keep-alive routes */
  children: ReactNode;
}

// Use a dedicated Map for keep-alive routes scroll positions
// This is separate from useScrollRestoration to avoid conflicts
const keepAliveScrollPositions = new Map<string, number>();

// Helper to check if a path matches any keep-alive pattern
const findMatchingPattern = (path: string, routes: KeepAliveRoute[]): KeepAliveRoute | undefined => {
  return routes.find(route => matchPath(route.pattern, path));
};

/**
 * Manages keep-alive routes alongside normal React Router routes.
 * Keep-alive routes stay mounted (hidden with display:none) while
 * other routes use normal React Router unmount behavior.
 * 
 * Supports dynamic routes like /u/:username - each unique path gets its own instance.
 */
export const KeepAliveRoutes = ({ keepAliveRoutes, children }: KeepAliveRoutesProps) => {
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Track which keep-alive paths have been visited (lazy mount)
  // This stores actual paths like "/u/john", not patterns
  const [mountedPaths, setMountedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (findMatchingPattern(currentPath, keepAliveRoutes)) {
      initial.add(currentPath);
    }
    return initial;
  });
  
  // Check if current route matches a keep-alive pattern
  const matchingRoute = useMemo(() => 
    findMatchingPattern(currentPath, keepAliveRoutes),
    [keepAliveRoutes, currentPath]
  );
  
  const isKeepAliveRoute = !!matchingRoute;
  
  // Mount keep-alive paths lazily when first visited
  useEffect(() => {
    if (isKeepAliveRoute && !mountedPaths.has(currentPath)) {
      setMountedPaths(prev => new Set(prev).add(currentPath));
    }
  }, [currentPath, isKeepAliveRoute, mountedPaths]);
  
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
    
    const wasKeepAlive = !!findMatchingPattern(previousPath.current, keepAliveRoutes);
    
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
        if (!mountedPaths.has(currentPath)) {
          window.scrollTo(0, 0);
        }
      }
    } else {
      // Entering a non-keep-alive route - scroll to top
      window.scrollTo(0, 0);
    }
    
    previousPath.current = currentPath;
  }, [currentPath, isKeepAliveRoute, keepAliveRoutes, mountedPaths]);
  
  // Group mounted paths by their matching route pattern
  const pathsByPattern = useMemo(() => {
    const map = new Map<string, string[]>();
    mountedPaths.forEach(path => {
      const route = findMatchingPattern(path, keepAliveRoutes);
      if (route) {
        const existing = map.get(route.pattern) || [];
        existing.push(path);
        map.set(route.pattern, existing);
      }
    });
    return map;
  }, [mountedPaths, keepAliveRoutes]);
  
  return (
    <>
      {/* Render all mounted keep-alive paths (hidden when not active) */}
      {keepAliveRoutes.map(route => {
        const paths = pathsByPattern.get(route.pattern) || [];
        return paths.map(path => (
          <KeepAlive
            key={path}
            route={path}
            currentRoute={currentPath}
          >
            {route.element(path)}
          </KeepAlive>
        ));
      })}
      
      {/* Render normal routes only when not on a keep-alive route */}
      {!isKeepAliveRoute && children}
    </>
  );
};
