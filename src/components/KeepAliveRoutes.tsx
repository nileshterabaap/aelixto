import { ReactNode, useMemo, useState, useEffect, useRef } from "react";
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
  
  // Scroll restoration for keep-alive routes
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const previousPath = useRef(currentPath);
  
  useEffect(() => {
    // Save scroll position when leaving a keep-alive route
    if (previousPath.current !== currentPath) {
      const wasKeepAlive = keepAliveRoutes.some(r => r.path === previousPath.current);
      if (wasKeepAlive) {
        scrollPositions.current.set(previousPath.current, window.scrollY);
      }
      
      // Restore scroll position when returning to a keep-alive route
      if (isKeepAliveRoute) {
        const savedPosition = scrollPositions.current.get(currentPath);
        if (savedPosition !== undefined) {
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            window.scrollTo(0, savedPosition);
          });
        }
      }
      
      previousPath.current = currentPath;
    }
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
