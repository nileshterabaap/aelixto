import { Heart, MessageCircle, Repeat2, Share, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onCreatePost: () => void;
}

export const Header = ({ onCreatePost }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b">
      <div className="flex flex-col">
        {/* Top row with logo and actions */}
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="text-2xl font-bold">Aelixto</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Bookmark className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <div className="relative">
                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
                  3
                </div>
                <MessageCircle className="h-5 w-5" />
              </div>
            </Button>
          </div>
        </div>
        
        {/* Action icons row */}
        <div className="flex items-center justify-around px-4 py-3 border-t border-b">
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Heart className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <MessageCircle className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Repeat2 className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Share className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Bookmark className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </header>
  );
};
