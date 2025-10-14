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
        <div className="flex h-16 items-center justify-between px-6">
          <h1 className="text-3xl font-bold tracking-tight">Aelixto</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-20 w-20">
              <Bookmark className="h-12 w-12 stroke-[1.5]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-20 w-20 relative">
              <MessageCircle className="h-12 w-12 stroke-[1.5]" />
              <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-[11px] font-bold text-white flex items-center justify-center">
                3
              </div>
            </Button>
          </div>
        </div>
        
        {/* Action icons row in bordered container */}
        <div className="mx-4 mb-4 px-6 py-3 border-2 border-foreground rounded-3xl">
          <div className="flex items-center justify-around">
            <Button variant="ghost" size="icon" className="h-24 w-24">
              <Heart className="h-14 w-14 stroke-[1.5]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-24 w-24">
              <MessageCircle className="h-14 w-14 stroke-[1.5]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-24 w-24">
              <Repeat2 className="h-14 w-14 stroke-[2.5]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-24 w-24">
              <Share className="h-14 w-14 stroke-[1.5]" />
            </Button>
            <Button variant="ghost" size="icon" className="h-24 w-24">
              <Bookmark className="h-14 w-14 stroke-[1.5]" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
