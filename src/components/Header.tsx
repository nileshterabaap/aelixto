import { Heart, MessageCircle, Repeat2, Share, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  onCreatePost: () => void;
}

export const Header = ({ onCreatePost }: HeaderProps) => {
  const navigate = useNavigate();
  
  return (
    <header className="sticky top-0 z-50 w-full bg-background">
      <div className="flex flex-col">
        {/* Top row with logo and actions */}
        <div className="flex h-16 items-center justify-between px-6">
          <h1 className="text-3xl font-bold tracking-tight">Aelixto</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Bookmark className="h-8 w-8 stroke-[2.5]" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 relative"
              onClick={() => navigate('/messages')}
            >
              <MessageCircle className="h-8 w-8 stroke-[2.5]" />
              <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-[11px] font-bold text-white flex items-center justify-center">
                3
              </div>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
