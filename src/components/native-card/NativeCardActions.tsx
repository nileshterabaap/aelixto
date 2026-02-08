import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Platform icons
import InstagramIcon from '@/assets/platforms/instagram.svg';
import TikTokIcon from '@/assets/platforms/tiktok.svg';
import YouTubeIcon from '@/assets/platforms/youtube.svg';
import XIcon from '@/assets/platforms/x.svg';
import FacebookIcon from '@/assets/platforms/facebook.svg';
import RedditIcon from '@/assets/platforms/reddit.svg';
import PinterestIcon from '@/assets/platforms/pinterest.svg';

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

function formatCount(count?: number): string {
  if (!count) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

interface NativeCardActionsProps {
  platform: string;
  // Aelixto engagement
  aelixtoLikes: number;
  aelixtoComments: number;
  isLikedByUser: boolean;
  onAelixtoLike: () => void;
  onAelixtoComment: () => void;
  // Platform engagement
  platformLikes?: number;
  platformComments?: number;
  isPlatformConnected: boolean;
  onPlatformLike?: () => void;
  onPlatformComment?: () => void;
}

export const NativeCardActions = ({
  platform,
  aelixtoLikes,
  aelixtoComments,
  isLikedByUser,
  onAelixtoLike,
  onAelixtoComment,
  platformLikes,
  platformComments,
  isPlatformConnected,
  onPlatformLike,
  onPlatformComment,
}: NativeCardActionsProps) => {
  const platformIcon = platformIcons[platform] || platformIcons.instagram;
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
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
              <span className="text-xs text-white/40">{formatCount(platformLikes)}</span>
            </button>
            <button 
              onClick={onPlatformComment}
              className="flex items-center gap-1.5 group"
            >
              <MessageCircle className="h-5 w-5 text-white/40 group-hover:text-white/60 transition-colors" />
              <span className="text-xs text-white/40">{formatCount(platformComments)}</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <img src={platformIcon} alt={platformName} className="w-3 h-3 opacity-40" />
            <span className="text-xs text-white/30">{platformName}</span>
          </div>
        </div>
      )}
    </div>
  );
};
