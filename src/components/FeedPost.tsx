import { Bookmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Post } from "@/data/demoData";

interface FeedPostProps {
  post: Post;
  onSave: (postId: string) => void;
}

const formatTimestamp = (date: Date) => {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const FeedPost = ({ post, onSave }: FeedPostProps) => {
  return (
    <Card className="overflow-hidden border-border/50">
      <div className="p-4">
        {/* Author Info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg">
            {post.author.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{post.author.name}</p>
            <p className="text-xs text-muted-foreground truncate">{post.author.username}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatTimestamp(post.timestamp)}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm mb-3 leading-relaxed">{post.content}</p>

        {/* Media */}
        {post.mediaType === 'image' && post.mediaUrl && (
          <div className="rounded-lg overflow-hidden mb-3">
            <img 
              src={post.mediaUrl} 
              alt="Post content"
              className="w-full h-auto max-h-96 object-cover"
            />
          </div>
        )}

        {post.mediaType === 'video' && post.mediaUrl && (
          <div className="rounded-lg overflow-hidden mb-3 bg-muted aspect-video flex items-center justify-center">
            <p className="text-sm text-muted-foreground">🎥 Video preview (embed coming soon)</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {post.saves} saves
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(post.id)}
            className="gap-1.5"
          >
            <Bookmark className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
};
