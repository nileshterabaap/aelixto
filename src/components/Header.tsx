import { Heart, MessageCircle, Repeat2, Share, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onCreatePost: () => void;
}

export const Header = ({ onCreatePost }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-background">
      <div className="flex flex-col">
        {/* Top row with logo and actions */}
        <div className="flex h-14 items-center justify-between px-5">
          <h1 className="text-3xl font-bold tracking-tight">Aelixto</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Bookmark className="h-6 w-6 stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 relative">
              <MessageCircle className="h-6 w-6 stroke-[2]" />
              <div className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
                3
              </div>
            </Button>
          </div>
        </div>
        
        {/* Action icons row in bordered container */}
        <div className="mx-4 mb-3 px-4 py-2 border-[3px] border-foreground rounded-[1.5rem]">
          <div className="flex items-center justify-around">
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Heart className="h-6 w-6 stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <MessageCircle className="h-6 w-6 stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Repeat2 className="h-6 w-6 stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Share className="h-6 w-6 stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Bookmark className="h-6 w-6 stroke-[2]" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
