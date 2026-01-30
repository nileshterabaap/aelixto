import { ReactNode, useMemo, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { KeepAlive } from "./KeepAlive";

interface KeepAliveRoutesProps {
  /** Routes to keep alive (won't unmount) */
  keepAliveRoutes: {
    path: string;
    element: ReactNode;
  }[];
  /** Fallback content for non-keep-alive routes */
  children: ReactNode;
}

// Persistent scroll positions across component lifecycles
const scrollPositions = new Map<string, number>();

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
        scrollPositions.set(currentPath, window.scrollY);
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
      scrollPositions.set(previousPath.current, window.scrollY);
    }
    
    // Restore scroll position when RETURNING to a keep-alive route
    if (isKeepAliveRoute) {
      const savedPosition = scrollPositions.get(currentPath);
      
      if (savedPosition !== undefined && savedPosition > 0) {
        isRestoringScroll.current = true;
        
        // Immediate restore attempt
        window.scrollTo(0, savedPosition);
        
        // Multiple retry attempts to handle any race conditions
        const delays = [0, 16, 50, 100, 200];
        delays.forEach(delay => {
          setTimeout(() => {
            window.scrollTo(0, savedPosition);
            if (delay === delays[delays.length - 1]) {
              isRestoringScroll.current = false;
            }
          }, delay);
        });
      } else {
        // First visit or was at top - scroll to top
        window.scrollTo(0, 0);
      }
    } else {
      // Entering a non-keep-alive route - scroll to top
      window.scrollTo(0, 0);
    }
    
    previousPath.current = currentPath;
  }, [currentPath, isKeepAliveRoute, keepAliveRoutes]);
  
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
