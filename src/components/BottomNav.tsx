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

  const baseIcon =
    "h-9 w-9 stroke-[2.5] text-black"; // outlined, black
  const activeIcon =
    "opacity-100";
  const inactiveIcon =
    "opacity-60 hover:opacity-100 transition-opacity";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-white">
      {/* container to center content and allow the floating + to overlap */}
      <div className="relative max-w-md mx-auto">
        {/* row of 4 side icons (2 left, 2 right)  */}
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-6">
            <Button
              aria-label="Home"
              variant="ghost"
              size="icon"
              className="h-14 w-14"
              onClick={() => navigate("/")}
            >
              <Home
                className={`${baseIcon} ${
                  isActive("/") ? activeIcon : inactiveIcon
                }`}
              />
            </Button>

            <Button
              aria-label="Explore"
              variant="ghost"
              size="icon"
              className="h-14 w-14"
              onClick={() => navigate("/discover")}
            >
              <Compass
                className={`${baseIcon} ${
                  isActive("/discover") ? activeIcon : inactiveIcon
                }`}
              />
            </Button>
          </div>

          <div className="flex items-center gap-6">
            <Button
              aria-label="Notifications"
              variant="ghost"
              size="icon"
              className="relative h-14 w-14"
              onClick={() => navigate("/notifications")}
            >
              <Bell
                className={`${baseIcon} ${
                  isActive("/notifications") ? activeIcon : inactiveIcon
                }`}
              />
              {/* red badge */}
              <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white">
                7
              </span>
            </Button>

            <Button
              aria-label="Profile"
              variant="ghost"
              size="icon"
              className="h-14 w-14"
              onClick={() => navigate("/profile")}
            >
              <User
                className={`${baseIcon} ${
                  isActive("/profile") ? activeIcon : inactiveIcon
                }`}
              />
            </Button>
          </div>
        </div>

        {/* floating center + button */}
        <button
          aria-label="Create post"
          onClick={onCreatePost}
          className="absolute left-1/2 -top-6 -translate-x-1/2 h-14 w-14 rounded-2xl bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)] ring-2 ring-black hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="mx-auto h-7 w-7 stroke-[3] text-white" />
        </button>
      </div>
    </nav>
  );
};