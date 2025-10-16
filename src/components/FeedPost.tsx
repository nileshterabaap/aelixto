import { Heart, MessageCircle, Repeat2, Share, Bookmark, MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Post } from "@/data/demoData";
import { useState } from "react";
import youtubeIcon from "@/assets/youtube-icon.png";
import instagramIcon from "@/assets/instagram-icon.png";
import tiktokIcon from "@/assets/tiktok-icon.png";
import redditIcon from "@/assets/reddit-icon.png";

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

const getPlatformIcon = (platform?: string) => {
  if (!platform) return null;
  
  switch (platform) {
    case 'youtube':
      return { name: 'YouTube', icon: youtubeIcon };
    case 'tiktok':
      return { name: 'TikTok', icon: tiktokIcon };
    case 'instagram':
      return { name: 'Instagram', icon: instagramIcon };
    case 'reddit':
      return { name: 'Reddit', icon: redditIcon };
    default:
      return null;
  }
};

export const FeedPost = ({ post, onSave }: FeedPostProps) => {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const platform = getPlatformIcon(post.platform);

  return (
    <Card className="overflow-hidden border-2 border-foreground rounded-[2rem]">
      <div className="p-5">
        {/* Author Info */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden bg-muted">
            <img 
              src={post.mediaUrl} 
              alt={post.author.username}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base">{post.author.username}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-6 w-6" />
          </Button>
        </div>

        {/* Title and Caption */}
        <div className="mb-3">
          <h2 className="text-lg font-bold mb-1">{post.title}</h2>
          <p className="text-sm text-muted-foreground">{post.content}</p>
        </div>

        {/* Media */}
        {post.mediaType === 'image' && post.mediaUrl && (
          <div className="rounded-2xl overflow-hidden mb-2 relative">
            <img 
              src={post.mediaUrl} 
              alt="Post content"
              className={`w-full h-auto object-cover ${
                platform?.name === 'Instagram' ? 'aspect-square' : 
                platform?.name === 'TikTok' ? 'aspect-[9/16]' : 
                'aspect-[16/9]'
              }`}
            />
            {platform && (
              <div className="absolute top-3 right-3 bg-white/90 rounded-full p-2">
                <img 
                  src={platform.icon} 
                  alt={platform.name}
                  className="w-6 h-6"
                />
              </div>
            )}
          </div>
        )}

        {post.mediaType === 'video' && post.mediaUrl && (
          <div className={`rounded-2xl overflow-hidden mb-2 bg-muted flex items-center justify-center relative ${
            platform?.name === 'TikTok' ? 'aspect-[9/16]' : 
            platform?.name === 'YouTube' ? 'aspect-[16/9]' : 
            'aspect-[4/3]'
          }`}>
            <div className="absolute inset-0">
              <img 
                src={post.mediaUrl} 
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
            {platform && (
              <div className="absolute top-3 right-3 z-20 bg-white/90 rounded-full p-2">
                <img 
                  src={platform.icon} 
                  alt={platform.name}
                  className="w-6 h-6"
                />
              </div>
            )}
            <div className="relative z-10 h-16 w-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1"></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-around px-2 py-4 mt-1">
          <button
            onClick={() => setLiked(!liked)}
            className="p-2 hover:opacity-60 transition-opacity"
          >
            <Heart className={`h-7 w-7 stroke-[1.5] ${liked ? 'fill-red-500 text-red-500' : 'fill-none'}`} />
          </button>
          <button className="p-2 hover:opacity-60 transition-opacity">
            <MessageCircle className="h-7 w-7 stroke-[1.5] fill-none" />
          </button>
          <button className="p-2 hover:opacity-60 transition-opacity">
            <Repeat2 className="h-8 w-8 stroke-[2.5]" />
          </button>
          <button className="p-2 hover:opacity-60 transition-opacity">
            <Share className="h-7 w-7 stroke-[1.5]" />
          </button>
          <button
            onClick={() => {
              setSaved(!saved);
              onSave(post.id);
            }}
            className="p-2 hover:opacity-60 transition-opacity"
          >
            <Bookmark className={`h-7 w-7 stroke-[1.5] ${saved ? 'fill-current' : 'fill-none'}`} />
          </button>
        </div>
      </div>
    </Card>
  );
};
