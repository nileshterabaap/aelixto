import { Heart, MessageCircle, Repeat2, Share, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onCreatePost: () => void;
}

export const Header = ({ onCreatePost }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b border-border/30">
      <div className="flex flex-col">
        {/* Top row with logo and actions */}
        <div className="flex h-14 items-center justify-between px-5">
          <h1 className="text-[28px] font-bold tracking-tight">Aelixto</h1>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Bookmark className="h-[22px] w-[22px] stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 relative">
              <MessageCircle className="h-[22px] w-[22px] stroke-[2]" />
              <div className="absolute top-[6px] right-[6px] h-[18px] w-[18px] rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
                3
              </div>
            </Button>
          </div>
        </div>
        
        {/* Action icons row in bordered container */}
        <div className="mx-4 mb-3 px-4 py-2.5 border-[2.5px] border-foreground rounded-[1.75rem]">
          <div className="flex items-center justify-around">
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Heart className="h-[26px] w-[26px] stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <MessageCircle className="h-[26px] w-[26px] stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Repeat2 className="h-[26px] w-[26px] stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Share className="h-[26px] w-[26px] stroke-[2]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Bookmark className="h-[26px] w-[26px] stroke-[2]" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
