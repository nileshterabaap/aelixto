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

  // Larger icons
  const baseIcon = "h-10 w-10 text-black"; // ~40px
  const activeIcon = "opacity-100";
  const inactiveIcon = "opacity-60 hover:opacity-100 transition-opacity";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto max-w-md">
        {/* 5 columns: 1=home, 2=discover, 3=spacer, 4=notifications, 5=profile */}
        <div className="grid grid-cols-5 place-items-center h-20 px-5">
          {/* Home */}
          <Button
            aria-label="Home"
            variant="ghost"
            // IMPORTANT: remove size="icon" so these sizes win
            className="h-16 w-16 p-0"
            onClick={() => navigate("/")}
          >
            <Home
              fill="currentColor"
              // heavier strokes make icons read larger, closer to your mock
              className={`${baseIcon} ${isActive("/") ? activeIcon : inactiveIcon}`}
              strokeWidth={3}
            />
          </Button>

          {/* Discover */}
          <Button
            aria-label="Explore"
            variant="ghost"
            className="h-16 w-16 p-0"
            onClick={() => navigate("/discover")}
          >
            <Compass
              strokeWidth={3}
              className={`${baseIcon} ${isActive("/discover") ? activeIcon : inactiveIcon}`}
            />
          </Button>

          {/* Spacer for center FAB */}
          <div aria-hidden className="h-16 w-16" />

          {/* Notifications */}
          <Button
            aria-label="Notifications"
            variant="ghost"
            className="relative h-16 w-16 p-0"
            onClick={() => navigate("/notifications")}
          >
            <Bell
              fill="currentColor"
              strokeWidth={3}
              className={`${baseIcon} ${isActive("/notifications") ? activeIcon : inactiveIcon}`}
            />
            {/* Badge */}
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-[6px] text-[11px] font-bold leading-none text-white ring-2 ring-white">
              7
            </span>
          </Button>

          {/* Profile */}
          <Button
            aria-label="Profile"
            variant="ghost"
            className="h-16 w-16 p-0"
            onClick={() => navigate("/profile")}
          >
            <User
              strokeWidth={3}
              className={`${baseIcon} ${isActive("/profile") ? activeIcon : inactiveIcon}`}
            />
          </Button>
        </div>

        {/* Layered FAB shadow to match your reference */}
        <div className="pointer-events-none absolute left-1/2 -top-10 -translate-x-1/2 w-28 h-16">
          {/* core crisp oval */}
          <div className="absolute left-1/2 top-[84px] -translate-x-1/2 h-4 w-24 rounded-full bg-black/38 blur-md" />
          {/* wide soft glow */}
          <div className="absolute left-1/2 top-[70px] -translate-x-1/2 h-6 w-28 rounded-full bg-black/18 blur-xl" />
        </div>

        {/* Floating + button (rounded square) */}
        <button
          aria-label="Create post"
          onClick={onCreatePost}
          className="absolute left-1/2 -top-12 -translate-x-1/2 h-16 w-16 rounded-2xl bg-black text-white
                     shadow-[0_14px_22px_rgba(0,0,0,0.38)] hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="mx-auto h-8 w-8 stroke-[3] text-white" />
        </button>
      </div>
    </nav>
  );
};