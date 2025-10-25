import { Heart, MessageCircle, Repeat2, Share, Bookmark, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInstagramRender } from "@/contexts/InstagramRenderContext";

interface HeaderProps {
  onCreatePost: () => void;
}

export const Header = ({ onCreatePost }: HeaderProps) => {
  const navigate = useNavigate();
  const { renderMode, setRenderMode } = useInstagramRender();
  
  return (
    <header className="sticky top-0 z-50 w-full bg-background">
      <div className="flex flex-col">
        {/* Top row with logo and actions */}
        <div className="flex h-16 items-center justify-between px-6">
          <h1 className="text-3xl font-bold tracking-tight">Aelixto</h1>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Settings className="h-6 w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Instagram Render Mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={renderMode} onValueChange={(value) => setRenderMode(value as 'official' | 'clean')}>
                  <DropdownMenuRadioItem value="official">
                    Official Embed
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Instagram UI included
                    </span>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="clean">
                    Clean Preview
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Minimal card, click to open
                    </span>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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
