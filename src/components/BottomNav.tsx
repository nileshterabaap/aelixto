import { Home, Search, Plus, Bell, User, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useCallback, MouseEvent, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchRoute } from "@/lib/prefetch";
import { setScrollPosition } from "@/hooks/useScrollRestoration";
import { useNotificationCount } from "@/hooks/useNotifications";

interface BottomNavProps {
  onCreatePost: () => void;
}

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const BottomNav = ({ onCreatePost }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { count: notificationCount } = useNotificationCount();
  const isActive = (path: string) => {
    if (path === "/profile") {
      return location.pathname === "/profile" || location.pathname.startsWith("/u/");
    }
    return location.pathname === path;
  };
  const [ripples, setRipples] = useState<Record<string, Ripple[]>>({});
  
  // Track last home tap time to detect double-tap for refresh
  const lastHomeTapRef = useRef<number>(0);

  const baseIcon = "text-foreground transition-opacity duration-200";
  const activeIcon = "h-9 w-9 opacity-100";
  const inactiveIcon = "h-7 w-7 opacity-50 hover:opacity-80";

  const navTapSpring = { scale: 0.85, transition: { type: "spring" as const, stiffness: 600, damping: 20 } };

  const createRipple = useCallback((e: MouseEvent<HTMLButtonElement>, key: string) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left - 12;
    const y = e.clientY - rect.top - 12;
    const id = Date.now();

    setRipples(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), { x, y, id }]
    }));

    setTimeout(() => {
      setRipples(prev => ({
        ...prev,
        [key]: (prev[key] || []).filter(r => r.id !== id)
      }));
    }, 600);
  }, []);

  // Prefetch on hover (desktop) or touch start (mobile)
  const handlePrefetch = useCallback((path: string) => {
    prefetchRoute(path, queryClient);
  }, [queryClient]);

  const handleHomeClick = (e: MouseEvent<HTMLButtonElement>) => {
    createRipple(e, "home");
    
    const now = Date.now();
    const isAlreadyOnHome = location.pathname === "/";
    const isAtTop = window.scrollY < 50;
    
    if (isAlreadyOnHome) {
      if (isAtTop) {
        // Already at top - force refresh the feed (refetchQueries actually refetches, invalidate just marks stale)
        queryClient.refetchQueries({ queryKey: ["following-feed"] });
        queryClient.refetchQueries({ queryKey: ["posts"] });
      } else {
        // Not at top - scroll to top smoothly
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      lastHomeTapRef.current = now;
    } else {
      // Navigate to home
      setScrollPosition(location.pathname, window.scrollY);
      navigate("/");
    }
  };

  const handleClick = (e: MouseEvent<HTMLButtonElement>, path: string, key: string) => {
    createRipple(e, key);
    // Snapshot scroll position for the current route BEFORE navigation.
    // (React Router may reset scroll to top during route change, which can
    // otherwise overwrite our saved value.)
    setScrollPosition(location.pathname, window.scrollY);
    navigate(path);
  };

  const handleTouchStart = (path: string) => {
    // Prefetch immediately on touch for instant navigation
    handlePrefetch(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border pb-[env(safe-area-inset-bottom)]">
      {/* max width like your feed */}
      <div className="relative mx-auto max-w-md">
        {/* 5 columns: 1=home, 2=discover, 3=empty (for FAB), 4=notifications, 5=profile */}
        <div className="grid grid-cols-5 place-items-center h-14 px-4">
          {/* Home */}
          <motion.button
            aria-label="Home"
            whileTap={navTapSpring}
            className="h-14 w-14 flex flex-col items-center justify-center gap-1 overflow-hidden relative bg-transparent border-0 outline-none"
            onClick={handleHomeClick}
            onMouseEnter={() => handlePrefetch("/")}
            onTouchStart={() => handleTouchStart("/")}
          >
            {ripples.home?.map(ripple => (
              <span
                key={ripple.id}
                className="absolute w-6 h-6 bg-foreground/20 rounded-full animate-ripple pointer-events-none"
                style={{ left: ripple.x, top: ripple.y }}
              />
            ))}
            <Home
              fill="currentColor"
              className={`${baseIcon} ${isActive("/") ? activeIcon : inactiveIcon}`}
            />
            {isActive("/") && <span className="absolute bottom-2 w-5 h-0.5 bg-foreground rounded-full animate-underline-slide" />}
          </motion.button>

          {/* Search/Discover */}
          <motion.button
            aria-label="Search"
            whileTap={navTapSpring}
            className="h-14 w-14 flex flex-col items-center justify-center gap-1 overflow-hidden relative bg-transparent border-0 outline-none"
            onClick={(e) => handleClick(e, "/discover", "discover")}
            onMouseEnter={() => handlePrefetch("/discover")}
            onTouchStart={() => handleTouchStart("/discover")}
          >
            {ripples.discover?.map(ripple => (
              <span
                key={ripple.id}
                className="absolute w-6 h-6 bg-foreground/20 rounded-full animate-ripple pointer-events-none"
                style={{ left: ripple.x, top: ripple.y }}
              />
            ))}
            <Search
              strokeWidth={2.5}
              className={`${baseIcon} ${isActive("/discover") ? activeIcon : inactiveIcon}`}
            />
            {isActive("/discover") && <span className="absolute bottom-2 w-5 h-0.5 bg-foreground rounded-full animate-underline-slide" />}
          </motion.button>

          {/* spacer for center FAB */}
          <div aria-hidden className="h-8 w-8" />

          {/* Notifications */}
          <motion.button
            aria-label="Notifications"
            whileTap={navTapSpring}
            className="relative h-14 w-14 flex flex-col items-center justify-center gap-1 overflow-hidden bg-transparent border-0 outline-none"
            onClick={(e) => handleClick(e, "/notifications", "notifications")}
          >
            {ripples.notifications?.map(ripple => (
              <span
                key={ripple.id}
                className="absolute w-6 h-6 bg-foreground/20 rounded-full animate-ripple pointer-events-none"
                style={{ left: ripple.x, top: ripple.y }}
              />
            ))}
            <Bell
              fill="currentColor"
              className={`${baseIcon} ${isActive("/notifications") ? activeIcon : inactiveIcon}`}
            />
            {isActive("/notifications") && <span className="absolute bottom-2 w-5 h-0.5 bg-foreground rounded-full animate-underline-slide" />}
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-[5px] text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background z-10 animate-scale-in">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </motion.button>

          <motion.button
            aria-label="Profile"
            whileTap={navTapSpring}
            className="h-14 w-14 flex flex-col items-center justify-center gap-1 overflow-hidden relative bg-transparent border-0 outline-none"
            onClick={(e) => handleClick(e, "/profile", "profile")}
            onMouseEnter={() => handlePrefetch("/profile")}
            onTouchStart={() => handleTouchStart("/profile")}
          >
            {ripples.profile?.map(ripple => (
              <span
                key={ripple.id}
                className="absolute w-6 h-6 bg-foreground/20 rounded-full animate-ripple pointer-events-none"
                style={{ left: ripple.x, top: ripple.y }}
              />
            ))}
            <User
              strokeWidth={2.5}
              fill={isActive("/profile") ? "currentColor" : "none"}
              className={`${baseIcon} ${isActive("/profile") ? activeIcon : inactiveIcon}`}
            />
            {isActive("/profile") && <span className="absolute bottom-2 w-5 h-0.5 bg-foreground rounded-full animate-underline-slide" />}
          </motion.button>
        </div>

        {/* Floating center + button (rounded square) */}
        {/* Soft oval shadow underneath to match your screenshot */}
        <div className="pointer-events-none absolute left-1/2 -top-4 -translate-x-1/2 w-20 h-8">
          <div className="absolute left-1/2 top-[40px] -translate-x-1/2 h-2 w-14 rounded-full bg-foreground/30 blur-md" />
          <div className="absolute left-1/2 top-[32px] -translate-x-1/2 h-3 w-16 rounded-full bg-foreground/10 blur-lg" />
        </div>

        <motion.button
          aria-label="Create post"
          onClick={onCreatePost}
          whileTap={{ scale: 0.9, transition: { type: "spring", stiffness: 600, damping: 20 } }}
          whileHover={{ scale: 1.05 }}
          className="absolute left-1/2 -top-4 -translate-x-1/2 h-12 w-12 rounded-2xl bg-foreground text-background"
        >
          <Plus className="mx-auto h-5 w-5 stroke-[3] text-background" />
        </motion.button>
      </div>
    </nav>
  );
};
