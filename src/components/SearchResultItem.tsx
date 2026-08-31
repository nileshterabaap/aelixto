import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { SearchResult } from "@/hooks/useUserSearch";
import { useFollow } from "@/hooks/useFollow";
import { useSession } from "@/hooks/useSession";

interface SearchResultItemProps {
  result: SearchResult;
  onSelect?: () => void;
}

export const SearchResultItem = ({ result, onSelect }: SearchResultItemProps) => {
  const navigate = useNavigate();
  const { user } = useSession();
  // Seed with the value already returned by search_profiles so the
  // Follow/Following label is correct on first paint — no 3-4s flicker.
  const { isFollowing, isRequested, follow, unfollow, loading } = useFollow(result.user_id, {
    initialIsFollowing: result.is_following,
    initialIsRequested: result.is_requested,
    initialFollowsMe: result.follows_me,
    skipInitialRefresh: true,
  });
  
  const isMe = user?.id === result.user_id;

  const handleClick = () => {
    navigate(`/u/${result.username}`);
    onSelect?.();
  };

  const handleFollowClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFollowing || isRequested) {
      unfollow();
    } else {
      follow();
    }
  };

  return (
    <div
      onClick={handleClick}
      className="tap-press flex items-center gap-3 p-3 hover:bg-accent/50 cursor-pointer transition-colors rounded-lg"
    >
      <Avatar className="h-12 w-12">
        <AvatarImage src={result.avatar_url || undefined} alt={result.username} />
        <AvatarFallback>
          {result.display_name?.[0] || result.username[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">
          {result.display_name || result.username}
        </p>
        <p className="text-muted-foreground text-sm truncate">
          @{result.username}
        </p>
      </div>
      
      {!isMe && user && (
        <Button
          size="sm"
          variant={(isFollowing || isRequested) ? "secondary" : "default"}
          disabled={loading}
          onClick={handleFollowClick}
          className="text-xs"
        >
          {loading ? "..." : isFollowing ? "Following" : isRequested ? "Asked" : result.follows_me ? "Follow Back" : "Follow"}
        </Button>
      )}
    </div>
  );
};