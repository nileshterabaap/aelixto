import { Home, Search, Plus, Bell, User, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useCallback, MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchRoute } from "@/lib/prefetch";
import { setScrollPosition } from "@/hooks/useScrollRestoration";
import { useNotificationCount } from "@/hooks/useNotifications";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { triggerFeedRefresh } from "@/components/PullToRefresh";

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
  const { profile: currentProfile } = useCurrentProfile();
  const isActive = (path: string) => {
    if (path === "/profile") {
      if (location.pathname === "/profile") return true;
      // Own profile route counts as profile tab
      if (
        currentProfile?.username &&
        location.pathname === `/u/${currentProfile.username}`
      ) {
        return true;
      }
      return false;
    }
    if (path === "/discover") {
      if (location.pathname === "/discover") return true;
      // Other users' profiles count as discover; own profile does not
      if (location.pathname.startsWith("/u/")) {
        if (
          currentProfile?.username &&
          location.pathname === `/u/${currentProfile.username}`
        ) {
          return false;
        }
        return true;
      }
      return false;
    }
    if (path === "/saved") return location.pathname === "/saved";
    if (path === "/messages") return location.pathname === "/messages";
    return location.pathname === path;
  };
  const [ripples, setRipples] = useState<Record<string, Ripple[]>>({});
  const baseIcon = "text-foreground transition-all duration-200";
  const activeIcon = "h-[3.375rem] w-[3.375rem] opacity-100";
  const inactiveIcon = "h-[2.625rem] w-[2.625rem] opacity-50 hover:opacity-80";

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
    
    const isAlreadyOnHome = location.pathname === "/";
    const isAtTop = window.scrollY < 50;
    
    if (isAlreadyOnHome) {
      if (!isAtTop) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Already at the top (or "All caught up") — refresh the feed.
        triggerFeedRefresh();
      }
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

  const handleProfileClick = (e: MouseEvent<HTMLButtonElement>) => {
    createRipple(e, "profile");
    // If already on the profile tab (own /profile or own /u/username), a
    // second tap should scroll back to the top instead of re-navigating.
    if (isActive("/profile")) {
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    setScrollPosition(location.pathname, window.scrollY);
    navigate("/profile");
  };

  const handleTouchStart = (path: string) => {
    // Prefetch immediately on touch for instant navigation
    handlePrefetch(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border pb-[var(--safe-bottom)]">
      {/* max width like your feed */}
      <div className="relative mx-auto max-w-md">
        {/* 5 columns: 1=home, 2=discover, 3=empty (for FAB), 4=notifications, 5=profile */}
        <div className="grid grid-cols-5 place-items-center h-14 px-4">
          {/* Home */}
          <Button
            aria-label="Home"
            variant="ghost"
            size="icon"
            className="h-14 w-14 active:scale-90 transition-transform flex flex-col items-center justify-center gap-1 overflow-hidden relative"
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
          </Button>

          {/* Search/Discover */}
          <Button
            aria-label="Search"
            variant="ghost"
            size="icon"
            className="h-14 w-14 active:scale-90 transition-transform flex flex-col items-center justify-center gap-1 overflow-hidden relative"
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
          </Button>

          {/* spacer for center FAB */}
          <div aria-hidden className="h-8 w-8" />

          {/* Notifications */}
          <Button
            aria-label="Notifications"
            variant="ghost"
            size="icon"
            className="relative h-14 w-14 active:scale-90 transition-transform flex flex-col items-center justify-center gap-1 overflow-hidden"
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
            {/* red badge - only show if there are unread notifications */}
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-[5px] text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background z-10 animate-scale-in">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </Button>

          <Button
            aria-label="Profile"
            variant="ghost"
            size="icon"
            className="h-14 w-14 active:scale-90 transition-transform flex flex-col items-center justify-center gap-1 overflow-hidden relative"
            onClick={handleProfileClick}
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
          </Button>
        </div>

        {/* Floating center + button (rounded square) */}
        <FabCreateButton onCreatePost={onCreatePost} />
      </div>
    </nav>
  );
};

const FabCreateButton = ({ onCreatePost }: { onCreatePost: () => void }) => {
  const [pressKey, setPressKey] = useState(0);
  const triggerPress = useCallback(() => {
    setPressKey((k) => k + 1);
  }, []);
  return (
    <button
      aria-label="Create post"
      onClick={onCreatePost}
      onPointerDown={triggerPress}
      style={{ transform: "translate3d(-50%,0,0)", WebkitTapHighlightColor: "transparent" }}
      className="absolute left-1/2 -top-4 h-12 w-12 select-none touch-manipulation focus:outline-none"
    >
      {/* Inner pressable shape — animates without affecting the outer translateX */}
      <span
        key={`press-${pressKey}`}
        style={{ transformOrigin: "50% 50%" }}
        className={`relative flex h-full w-full items-center justify-center rounded-2xl bg-foreground will-change-transform ${pressKey ? "animate-fab-press" : ""}`}
      >
        {/* Inner white flash */}
        <span
          key={`flash-${pressKey}`}
          className={`pointer-events-none absolute inset-0 rounded-2xl bg-background/45 opacity-0 ${pressKey ? "animate-fab-flash" : ""}`}
          aria-hidden
        />
        {/* Expanding ring blink */}
        <span
          key={`ring-${pressKey}`}
          className={`pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-foreground/70 opacity-0 ${pressKey ? "animate-fab-blink" : ""}`}
          aria-hidden
        />
        <Plus className="relative h-5 w-5 stroke-[3] text-background" />
      </span>
    </button>
  );
};
