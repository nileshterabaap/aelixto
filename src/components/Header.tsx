import { MessageCircle, Bookmark, LogOut, Settings as SettingsIcon, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useConversations } from "@/hooks/useConversations";
import { SearchResultItem } from "@/components/SearchResultItem";

interface HeaderProps {
  onCreatePost: () => void;
}

export const Header = ({ onCreatePost }: HeaderProps) => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { profile } = useCurrentProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { results, loading, hasMore, loadMore } = useUserSearch(searchQuery, searchOpen);
  const { conversations } = useConversations();
  
  // Calculate total unread messages
  const totalUnreadMessages = conversations.reduce((total, conv) => total + conv.unread_count, 0);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };
  
  return (
    <header className="sticky top-0 z-50 w-full bg-background border-b">
      <div className="flex flex-col">
        {/* Top row with logo and actions */}
        <div className="flex h-16 items-center justify-between px-6">
          <h1 
            className="text-3xl font-bold tracking-tight cursor-pointer" 
            onClick={() => navigate('/')}
          >
            Aelixto
          </h1>
          <div className="flex items-center gap-2">
            {user && (
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Search className="h-8 w-8 stroke-[2.5]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-2" align="end">
                  <Input
                    placeholder="Search users (@username or name)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-2"
                    autoFocus
                  />
                  <ScrollArea className="h-[400px]">
                    {loading && searchQuery && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Searching...
                      </p>
                    )}
                    {!loading && searchQuery && results.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No users found
                      </p>
                    )}
                    {results.map((result) => (
                      <SearchResultItem
                        key={result.id}
                        result={result}
                        onSelect={() => setSearchOpen(false)}
                      />
                    ))}
                    {hasMore && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={loadMore}
                        disabled={loading}
                      >
                        Load more
                      </Button>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
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
              {totalUnreadMessages > 0 && (
                <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-[11px] font-bold text-white flex items-center justify-center">
                  {totalUnreadMessages}
                </div>
              )}
            </Button>

            {!user && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
