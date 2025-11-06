import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { SearchResult } from "@/hooks/useUserSearch";

interface SearchResultItemProps {
  result: SearchResult;
  onSelect?: () => void;
}

export const SearchResultItem = ({ result, onSelect }: SearchResultItemProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/u/${result.username}`);
    onSelect?.();
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-3 p-3 hover:bg-accent/50 cursor-pointer transition-colors rounded-lg"
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
      
      {result.is_following && (
        <Badge variant="secondary" className="text-xs">
          Following
        </Badge>
      )}
    </div>
  );
};
