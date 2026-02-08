import { useState, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, ExternalLink, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Platform icons
import InstagramIcon from '@/assets/platforms/instagram.svg';
import TikTokIcon from '@/assets/platforms/tiktok.svg';
import YouTubeIcon from '@/assets/platforms/youtube.svg';
import XIcon from '@/assets/platforms/x.svg';
import FacebookIcon from '@/assets/platforms/facebook.svg';
import RedditIcon from '@/assets/platforms/reddit.svg';
import PinterestIcon from '@/assets/platforms/pinterest.svg';

interface NativeCardData {
  url: string;
  platform: string;
  media_type: 'video' | 'image' | 'text' | 'carousel';
  media_url?: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  author_name?: string;
  author_username?: string;
  author_avatar?: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  views_count?: number;
}

interface AelixtoNativeCardProps {
  data: NativeCardData;
  postId: string;
  // Internal Aelixto engagement
  aelixtoLikes: number;
  aelixtoComments: number;
  isLikedByUser: boolean;
  onAelixtoLike: () => void;
  onAelixtoComment: () => void;
  // Platform engagement (via Outstand)
  onPlatformLike?: () => void;
  onPlatformComment?: () => void;
  isPlatformConnected?: boolean;
  onConnectPlatform?: () => void;
  onDismissConnectPrompt?: () => void;
  showConnectPrompt?: boolean;
}

const platformIcons: Record<string, string> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  x: XIcon,
  twitter: XIcon,
  facebook: FacebookIcon,
  reddit: RedditIcon,
  pinterest: PinterestIcon,
};

const platformColors: Record<string, string> = {
  instagram: 'from-purple-500 via-pink-500 to-orange-400',
  tiktok: 'from-cyan-400 to-pink-500',
  youtube: 'text-red-500',
  x: 'text-white',
  twitter: 'text-blue-400',
  facebook: 'text-blue-500',
  reddit: 'text-orange-500',
  pinterest: 'text-red-600',
};

// Helper to proxy images through img-proxy
function getProxiedUrl(url?: string): string {
  if (!url) return '/placeholder.svg';
  
  // Skip if already proxied or is a storage URL
  if (url.includes('/storage/v1/object/public/') || url.includes('img-proxy')) {
    return url;
  }
  
  // Only proxy https URLs
  if (!url.startsWith('https://')) {
    return url;
  }
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/img-proxy?u=${encodeURIComponent(url)}`;
}

function formatCount(count?: number): string {
  if (!count) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

export const AelixtoNativeCard = ({
  data,
  postId,
  aelixtoLikes,
  aelixtoComments,
  isLikedByUser,
  onAelixtoLike,
  onAelixtoComment,
  onPlatformLike,
  onPlatformComment,
  isPlatformConnected = false,
  onConnectPlatform,
  onDismissConnectPrompt,
  showConnectPrompt = false,
}: AelixtoNativeCardProps) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const platformIcon = platformIcons[data.platform] || platformIcons.instagram;
  const platformName = data.platform.charAt(0).toUpperCase() + data.platform.slice(1);

  const handleVideoClick = useCallback(() => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  }, [isVideoPlaying]);

  const caption = data.description || data.title || '';
  const truncatedCaption = caption.length > 150 ? caption.substring(0, 150) + '...' : caption;

  return (
    <div className="w-full bg-black rounded-xl overflow-hidden border border-white/10">
      {/* Connect Platform Prompt */}
      {showConnectPrompt && !isPlatformConnected && (
        <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={platformIcon} alt={platformName} className="w-4 h-4 opacity-70" />
            <span className="text-sm text-white/70">
              Connect {platformName} to interact on the platform
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onConnectPlatform}
              className="text-xs text-primary hover:text-primary/80"
            >
              Connect
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4 text-white/50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/95 border-white/10">
                <DropdownMenuItem 
                  onClick={onDismissConnectPrompt}
                  className="text-white/70 focus:text-white"
                >
                  <X className="h-4 w-4 mr-2" />
                  Don't ask again
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Author Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-white/20">
            <AvatarImage src={getProxiedUrl(data.author_avatar)} />
            <AvatarFallback className="bg-white/10 text-white">
              {data.author_name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">
              {data.author_name || 'Unknown'}
            </p>
            {data.author_username && (
              <p className="text-xs text-white/50">@{data.author_username}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <img 
            src={platformIcon} 
            alt={platformName} 
            className="w-5 h-5 opacity-60" 
          />
          <a 
            href={data.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-white/40 hover:text-white/60 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Media Content */}
      <div className="relative aspect-square bg-black">
        {data.media_type === 'video' && data.media_url ? (
          <video
            ref={videoRef}
            src={data.media_url}
            poster={getProxiedUrl(data.thumbnail_url)}
            className="w-full h-full object-cover cursor-pointer"
            onClick={handleVideoClick}
            loop
            playsInline
            muted
          />
        ) : data.media_type === 'text' ? (
          <div className="w-full h-full flex items-center justify-center p-8 bg-gradient-to-br from-black to-zinc-900">
            <p className="text-white text-lg text-center leading-relaxed font-light">
              {caption}
            </p>
          </div>
        ) : (
          <img
            src={getProxiedUrl(data.media_url || data.thumbnail_url)}
            alt={data.title || 'Post media'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}

        {/* Video play indicator */}
        {data.media_type === 'video' && !isVideoPlaying && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
            onClick={handleVideoClick}
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <div className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Split Actions */}
      <div className="px-4 py-3 border-t border-white/10">
        {/* Aelixto Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <button 
              onClick={onAelixtoLike}
              className="flex items-center gap-1.5 group"
            >
              <Heart 
                className={cn(
                  "h-6 w-6 transition-colors",
                  isLikedByUser 
                    ? "fill-red-500 text-red-500" 
                    : "text-white/70 group-hover:text-white"
                )} 
              />
              <span className="text-sm text-white/70">{formatCount(aelixtoLikes)}</span>
            </button>
            <button 
              onClick={onAelixtoComment}
              className="flex items-center gap-1.5 group"
            >
              <MessageCircle className="h-6 w-6 text-white/70 group-hover:text-white transition-colors" />
              <span className="text-sm text-white/70">{formatCount(aelixtoComments)}</span>
            </button>
            <button className="group">
              <Share2 className="h-6 w-6 text-white/70 group-hover:text-white transition-colors" />
            </button>
          </div>
          <span className="text-xs text-white/30">Aelixto</span>
        </div>

        {/* Platform Actions (only if connected) */}
        {isPlatformConnected && (
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex items-center gap-4">
              <button 
                onClick={onPlatformLike}
                className="flex items-center gap-1.5 group"
              >
                <Heart className="h-5 w-5 text-white/40 group-hover:text-white/60 transition-colors" />
                <span className="text-xs text-white/40">{formatCount(data.likes_count)}</span>
              </button>
              <button 
                onClick={onPlatformComment}
                className="flex items-center gap-1.5 group"
              >
                <MessageCircle className="h-5 w-5 text-white/40 group-hover:text-white/60 transition-colors" />
                <span className="text-xs text-white/40">{formatCount(data.comments_count)}</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <img src={platformIcon} alt={platformName} className="w-3 h-3 opacity-40" />
              <span className="text-xs text-white/30">{platformName}</span>
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      {data.media_type !== 'text' && caption && (
        <div className="px-4 pb-4">
          <p className="text-sm text-white/80 leading-relaxed">
            <span className="font-semibold text-white mr-1">
              {data.author_username || data.author_name}
            </span>
            {showFullCaption ? caption : truncatedCaption}
          </p>
          {caption.length > 150 && (
            <button 
              onClick={() => setShowFullCaption(!showFullCaption)}
              className="text-xs text-white/40 mt-1 hover:text-white/60"
            >
              {showFullCaption ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
