import { Home, Compass, Plus, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";

interface BottomNavProps {
  onCreatePost: () => void;
}

export const BottomNav = ({ onCreatePost }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const baseIcon = "h-12 w-12 text-black";
  const activeIcon = "opacity-100";
  const inactiveIcon = "opacity-60 hover:opacity-100 transition-opacity";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-white pb-[env(safe-area-inset-bottom)]">
      {/* max width like your feed */}
      <div className="relative mx-auto max-w-md">
        {/* 5 columns: 1=home, 2=discover, 3=empty (for FAB), 4=notifications, 5=profile */}
        <div className="grid grid-cols-5 place-items-center h-20 px-4">
          {/* Home */}
          <Button
            aria-label="Home"
            variant="ghost"
            size="icon"
            className="h-20 w-20"
            onClick={() => navigate("/")}
          >
            <Home
              fill="currentColor"
              className={`${baseIcon} ${isActive("/") ? activeIcon : inactiveIcon}`}
            />
          </Button>

          {/* Discover */}
          <Button
            aria-label="Explore"
            variant="ghost"
            size="icon"
            className="h-20 w-20"
            onClick={() => navigate("/discover")}
          >
            <Compass
              strokeWidth={2.5}
              className={`${baseIcon} ${isActive("/discover") ? activeIcon : inactiveIcon}`}
            />
          </Button>

          {/* spacer for center FAB */}
          <div aria-hidden className="h-12 w-12" />

          {/* Notifications */}
          <Button
            aria-label="Notifications"
            variant="ghost"
            size="icon"
            className="relative h-20 w-20"
            onClick={() => navigate("/notifications")}
          >
            <Bell
              fill="currentColor"
              className={`${baseIcon} ${isActive("/notifications") ? activeIcon : inactiveIcon}`}
            />
            {/* red badge */}
            <span className="absolute top-3 right-3 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white ring-2 ring-white">
              7
            </span>
          </Button>

          {/* Profile */}
          <Button
            aria-label="Profile"
            variant="ghost"
            size="icon"
            className="h-20 w-20"
            onClick={() => navigate("/profile")}
          >
            <User
              strokeWidth={2.5}
              className={`${baseIcon} ${isActive("/profile") ? activeIcon : inactiveIcon}`}
            />
          </Button>
        </div>

        {/* Floating center + button (rounded square) */}
        {/* Soft oval shadow underneath to match your screenshot */}
        <div className="pointer-events-none absolute left-1/2 -top-5 -translate-x-1/2 w-24 h-10">
          <div className="absolute left-1/2 top-[52px] -translate-x-1/2 h-3 w-16 rounded-full bg-black/30 blur-md" />
          <div className="absolute left-1/2 top-[40px] -translate-x-1/2 h-4 w-20 rounded-full bg-black/10 blur-lg" />
        </div>

        <button
          aria-label="Create post"
          onClick={onCreatePost}
          className="absolute left-1/2 -top-5 -translate-x-1/2 h-14 w-14 rounded-2xl bg-black text-white 
                     hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="mx-auto h-6 w-6 stroke-[3] text-white" />
        </button>
      </div>
    </nav>
  );
};