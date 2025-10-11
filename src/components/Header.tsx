import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onCreatePost: () => void;
}

export const Header = ({ onCreatePost }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Aelixto
        </h1>
        <Button onClick={onCreatePost} size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Post
        </Button>
      </div>
    </header>
  );
};
