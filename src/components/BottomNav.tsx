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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t-[3px] border-foreground">
      <div className="flex items-center justify-around h-[72px] max-w-2xl mx-auto px-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-12 w-12"
          onClick={() => navigate("/")}
        >
          <Home className={`h-7 w-7 stroke-[2] ${isActive("/") ? "fill-current" : ""}`} />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-12 w-12"
          onClick={() => navigate("/discover")}
        >
          <Compass className={`h-7 w-7 stroke-[2] ${isActive("/discover") ? "fill-current" : ""}`} />
        </Button>
        
        <Button 
          size="icon" 
          className="h-[58px] w-[58px] rounded-full bg-foreground hover:bg-foreground/90 shadow-lg"
          onClick={onCreatePost}
        >
          <Plus className="h-8 w-8 text-background stroke-[3]" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-12 w-12 relative"
          onClick={() => navigate("/notifications")}
        >
          <Bell className={`h-7 w-7 stroke-[2] ${isActive("/notifications") ? "fill-current" : ""}`} />
          <div className="absolute top-[6px] right-[6px] h-[18px] w-[18px] rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
            3
          </div>
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-12 w-12"
          onClick={() => navigate("/profile")}
        >
          <User className={`h-7 w-7 stroke-[2] ${isActive("/profile") ? "fill-current" : ""}`} />
        </Button>
      </div>
    </nav>
  );
};
