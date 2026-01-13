import { Home, Compass, Plus, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useCallback, MouseEvent } from "react";

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
  const isActive = (path: string) => {
    if (path === "/profile") {
      return location.pathname === "/profile" || location.pathname.startsWith("/u/");
    }
    return location.pathname === path;
  };
  const [ripples, setRipples] = useState<Record<string, Ripple[]>>({});

  const baseIcon = "text-foreground transition-all duration-200";
  const activeIcon = "h-9 w-9 opacity-100";
  const inactiveIcon = "h-7 w-7 opacity-50 hover:opacity-80";

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

  const handleClick = (e: MouseEvent<HTMLButtonElement>, path: string, key: string) => {
    createRipple(e, key);
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border pb-[env(safe-area-inset-bottom)]">
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
            onClick={(e) => handleClick(e, "/", "home")}
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

          {/* Discover */}
          <Button
            aria-label="Explore"
            variant="ghost"
            size="icon"
            className="h-14 w-14 active:scale-90 transition-transform flex flex-col items-center justify-center gap-1 overflow-hidden relative"
            onClick={(e) => handleClick(e, "/discover", "discover")}
          >
            {ripples.discover?.map(ripple => (
              <span
                key={ripple.id}
                className="absolute w-6 h-6 bg-foreground/20 rounded-full animate-ripple pointer-events-none"
                style={{ left: ripple.x, top: ripple.y }}
              />
            ))}
            <Compass
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
            {/* red badge */}
            <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white ring-2 ring-background z-10">
              7
            </span>
          </Button>

          {/* Profile */}
          <Button
            aria-label="Profile"
            variant="ghost"
            size="icon"
            className="h-14 w-14 active:scale-90 transition-transform flex flex-col items-center justify-center gap-1 overflow-hidden relative"
            onClick={(e) => handleClick(e, "/profile", "profile")}
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
        {/* Soft oval shadow underneath to match your screenshot */}
        <div className="pointer-events-none absolute left-1/2 -top-4 -translate-x-1/2 w-20 h-8">
          <div className="absolute left-1/2 top-[40px] -translate-x-1/2 h-2 w-14 rounded-full bg-foreground/30 blur-md" />
          <div className="absolute left-1/2 top-[32px] -translate-x-1/2 h-3 w-16 rounded-full bg-foreground/10 blur-lg" />
        </div>

        <button
          aria-label="Create post"
          onClick={onCreatePost}
          className="absolute left-1/2 -top-4 -translate-x-1/2 h-12 w-12 rounded-2xl bg-foreground text-background 
                     hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="mx-auto h-5 w-5 stroke-[3] text-background" />
        </button>
      </div>
    </nav>
  );
};
