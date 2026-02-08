import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={platformIcon} alt={platformName} className="w-5 h-5" />
        <span className="text-sm text-gray-700">
          Connect {platformName} to interact
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={onConnect}
          className="bg-[#0095f6] hover:bg-[#1877f2] text-white text-sm font-semibold rounded-md px-4"
        >
          Connect
        </Button>
        <button 
          onClick={onDismiss}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
};
