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
    <Card className="overflow-hidden border-[3px] border-foreground rounded-[2.5rem] bg-background animate-fade-in">
      <div className="p-4">
        {/* Author Info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full overflow-hidden bg-muted">
            <img 
              src={post.mediaUrl} 
              alt={post.author.username}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[15px]">{post.author.username}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        {/* Media */}
        {post.mediaType === 'image' && post.mediaUrl && (
          <div className="rounded-[1.5rem] overflow-hidden mb-3">
            <img 
              src={post.mediaUrl} 
              alt="Post content"
              className="w-full h-auto aspect-[4/3] object-cover"
            />
          </div>
        )}

        {post.mediaType === 'video' && post.mediaUrl && (
          <div className="rounded-[1.5rem] overflow-hidden mb-3 bg-muted aspect-[4/3] flex items-center justify-center relative">
            <div className="absolute inset-0">
              <img 
                src={post.mediaUrl} 
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="relative z-10 h-14 w-14 rounded-full bg-foreground flex items-center justify-center">
              <div className="w-0 h-0 border-l-[14px] border-l-background border-t-[11px] border-t-transparent border-b-[11px] border-b-transparent ml-1"></div>
            </div>
          </div>
        )}

        {/* Actions - Inside bordered container */}
        <div className="border-[2.5px] border-foreground rounded-[1.75rem] px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLiked(!liked)}
                className="h-11 w-11"
              >
                <Heart className={`h-[26px] w-[26px] stroke-[2] ${liked ? 'fill-destructive text-destructive' : ''}`} />
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
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSaved(!saved);
                onSave(post.id);
              }}
              className="h-11 w-11"
            >
              <Bookmark className={`h-[26px] w-[26px] stroke-[2] ${saved ? 'fill-current' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
