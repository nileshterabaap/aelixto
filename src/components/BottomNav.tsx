import { Home, Search, PlusCircle, Heart, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

type BottomNavProps = {
  onCreatePost: () => void;
};

export const BottomNav = ({ onCreatePost }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="mx-auto max-w-2xl px-4">
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => navigate("/")}
            className={`flex flex-col items-center justify-center h-16 w-16 rounded-lg transition-colors ${
              isActive("/") ? "text-foreground" : "text-muted-foreground"
            }`}
            aria-label="Home"
          >
            <Home className="h-12 w-12 stroke-[2.5]" />
          </button>

          <button
            onClick={() => {}}
            className="flex flex-col items-center justify-center h-16 w-16 rounded-lg text-muted-foreground transition-colors"
            aria-label="Search"
          >
            <Search className="h-12 w-12 stroke-[2.5]" />
          </button>

          <button
            onClick={onCreatePost}
            className="flex flex-col items-center justify-center h-16 w-16 rounded-lg text-foreground transition-colors shadow-lg"
            aria-label="Create Post"
          >
            <PlusCircle className="h-12 w-12 stroke-[2.5]" />
          </button>

          <button
            onClick={() => {}}
            className="flex flex-col items-center justify-center h-16 w-16 rounded-lg text-muted-foreground transition-colors"
            aria-label="Notifications"
          >
            <Heart className="h-12 w-12 stroke-[2.5]" />
          </button>

          <button
            onClick={() => navigate("/profile")}
            className={`flex flex-col items-center justify-center h-16 w-16 rounded-lg transition-colors ${
              isActive("/profile") ? "text-foreground" : "text-muted-foreground"
            }`}
            aria-label="Profile"
          >
            <User className="h-12 w-12 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </nav>
  );
};
