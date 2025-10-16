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

  // Bigger icons
  const baseIcon = "h-9 w-9 text-black";
  const activeIcon = "opacity-100";
  const inactiveIcon = "opacity-60 hover:opacity-100 transition-opacity";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto max-w-md">
        {/* --- Curved notch background under the FAB --- */}
        <div className="pointer-events-none absolute left-0 right-0 -top-8 h-[104px]">
          <svg
            viewBox="0 0 1000 104"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {/* white bar */}
            <path d="M0,0 H1000 V104 H0 Z" fill="white" />
            {/* notch dip (centered) */}
            <path
              d="
                M 450 0
                C 470 0, 485 16, 500 16
                C 515 16, 530 0, 550 0
                L 550 0 L 450 0 Z
              "
              fill="white"
            />
          </svg>
        </div>

        {/* 5 columns: 1=home, 2=discover, 3=spacer, 4=notifications, 5=profile */}
        <div className="grid grid-cols-5 place-items-center h-20 px-6 border-t border-transparent">
          {/* Home */}
          <Button
            aria-label="Home"
            variant="ghost"
            size="icon"
            className="h-16 w-16"
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
            className="h-16 w-16"
            onClick={() => navigate("/discover")}
          >
            <Compass
              strokeWidth={2.6}
              className={`${baseIcon} ${
                isActive("/discover") ? activeIcon : inactiveIcon
              }`}
            />
          </Button>

          {/* Spacer for FAB */}
          <div aria-hidden className="h-16 w-16" />

          {/* Notifications */}
          <Button
            aria-label="Notifications"
            variant="ghost"
            size="icon"
            className="relative h-16 w-16"
            onClick={() => navigate("/notifications")}
          >
            <Bell
              fill="currentColor"
              className={`${baseIcon} ${
                isActive("/notifications") ? activeIcon : inactiveIcon
              }`}
            />
            <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-[6px] text-[11px] font-bold leading-none text-white ring-2 ring-white">
              7
            </span>
          </Button>

          {/* Profile */}
          <Button
            aria-label="Profile"
            variant="ghost"
            size="icon"
            className="h-16 w-16"
            onClick={() => navigate("/profile")}
          >
            <User
              strokeWidth={2.6}
              className={`${baseIcon} ${
                isActive("/profile") ? activeIcon : inactiveIcon
              }`}
            />
          </Button>
        </div>

        {/* --- Floating + button with stronger, layered shadow --- */}
        {/* shadow “pillow” layers */}
        <div className="pointer-events-none absolute left-1/2 -top-9 -translate-x-1/2 w-28 h-14">
          {/* crisper core shadow */}
          <div className="absolute left-1/2 top-[76px] -translate-x-1/2 h-4 w-24 rounded-full bg-black/35 blur-md" />
          {/* wide soft glow */}
          <div className="absolute left-1/2 top-[64px] -translate-x-1/2 h-6 w-28 rounded-full bg-black/15 blur-xl" />
        </div>

        <button
          aria-label="Create post"
          onClick={onCreatePost}
          className="absolute left-1/2 -top-10 -translate-x-1/2 h-16 w-16 rounded-2xl bg-black text-white
                     shadow-[0_14px_22px_rgba(0,0,0,0.38)] hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="mx-auto h-8 w-8 stroke-[3] text-white" />
        </button>
      </div>
    </nav>
  );
};