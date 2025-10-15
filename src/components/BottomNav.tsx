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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t-2 border-foreground">
      <div className="flex items-center justify-around h-20 max-w-2xl mx-auto px-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-14 w-14"
          onClick={() => navigate("/")}
        >
          <Home className={`h-8 w-8 stroke-[2] ${isActive("/") ? "fill-current" : ""}`} />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-14 w-14"
          onClick={() => navigate("/discover")}
        >
          <Compass className={`h-8 w-8 stroke-[2] ${isActive("/discover") ? "fill-current" : ""}`} />
        </Button>
        
        <Button 
          size="icon" 
          className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
          onClick={onCreatePost}
        >
          <Plus className="h-9 w-9 text-primary-foreground stroke-[2.5]" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-14 w-14 relative"
          onClick={() => navigate("/notifications")}
        >
          <Bell className={`h-8 w-8 stroke-[2] ${isActive("/notifications") ? "fill-current" : ""}`} />
          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-destructive text-[11px] font-bold text-white flex items-center justify-center">
            7
          </div>
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-14 w-14"
          onClick={() => navigate("/profile")}
        >
          <User className={`h-8 w-8 stroke-[2] ${isActive("/profile") ? "fill-current" : ""}`} />
        </Button>
      </div>
    </nav>
  );
};
