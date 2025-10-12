import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Post } from "@/data/demoData";
import { useState } from "react";

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
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <Card className="overflow-hidden border rounded-3xl">
      <div className="p-4">
        {/* Author Info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
            {post.author.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{post.author.username}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        {/* Media */}
        {post.mediaType === 'image' && post.mediaUrl && (
          <div className="rounded-2xl overflow-hidden mb-3 -mx-4 px-4">
            <img 
              src={post.mediaUrl} 
              alt="Post content"
              className="w-full h-auto max-h-[500px] object-cover rounded-2xl"
            />
          </div>
        )}

        {post.mediaType === 'video' && post.mediaUrl && (
          <div className="rounded-2xl overflow-hidden mb-3 bg-muted aspect-video flex items-center justify-center">
            <p className="text-sm text-muted-foreground">🎥 Video preview</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLiked(!liked)}
              className="h-10 w-10"
            >
              <Heart className={`h-6 w-6 ${liked ? 'fill-destructive text-destructive' : ''}`} />
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
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSaved(!saved);
              onSave(post.id);
            }}
            className="h-10 w-10"
          >
            <Bookmark className={`h-6 w-6 ${saved ? 'fill-current' : ''}`} />
          </Button>
        </div>
      </div>
    </Card>
  );
};
