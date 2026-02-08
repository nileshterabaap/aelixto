import { MoreHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

interface ConnectPromptBannerProps {
  platform: string;
  onConnect: () => void;
  onDismiss: () => void;
}

export const ConnectPromptBanner = ({
  platform,
  onConnect,
  onDismiss,
}: ConnectPromptBannerProps) => {
  const platformIcon = platformIcons[platform] || platformIcons.instagram;
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
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
          onClick={onConnect}
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
              onClick={onDismiss}
              className="text-white/70 focus:text-white"
            >
              <X className="h-4 w-4 mr-2" />
              Don't ask again
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
