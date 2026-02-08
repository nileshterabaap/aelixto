import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

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

interface NativeCardHeaderProps {
  platform: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatar?: string;
  postUrl: string;
  proxyFn: (url?: string) => string;
}

export const NativeCardHeader = ({
  platform,
  authorName,
  authorUsername,
  authorAvatar,
  postUrl,
  proxyFn,
}: NativeCardHeaderProps) => {
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const platformIcon = platformIcons[platform] || platformIcons.instagram;
  const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

  // Display name priority: author_name > author_username > platform name
  const displayName = authorName || authorUsername || platformName;
  const displayUsername = authorUsername ? `@${authorUsername}` : null;

  // Get avatar initial
  const avatarInitial = displayName?.charAt(0).toUpperCase() || '?';

  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-white/20 bg-zinc-800">
          {authorAvatar ? (
            <>
              {!avatarLoaded && (
                <Skeleton className="absolute inset-0 rounded-full bg-zinc-700" />
              )}
              <AvatarImage 
                src={proxyFn(authorAvatar)} 
                onLoad={() => setAvatarLoaded(true)}
                className={avatarLoaded ? 'opacity-100' : 'opacity-0'}
              />
            </>
          ) : null}
          <AvatarFallback className="bg-zinc-700 text-white">
            {avatarInitial}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-white leading-tight">
            {displayName}
          </p>
          {displayUsername && displayUsername !== `@${displayName}` && (
            <p className="text-xs text-white/50">{displayUsername}</p>
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
          href={postUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white/40 hover:text-white/60 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
};
