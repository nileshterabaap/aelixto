import { useState } from 'react';
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

  // Display name priority: author_username > author_name > platform name
  const displayName = authorUsername || authorName || platformName;
  const subtitle = authorName && authorUsername && authorName !== authorUsername 
    ? authorName 
    : null;

  // Get avatar initial
  const avatarInitial = displayName?.charAt(0).toUpperCase() || '?';

  return (
    <div className="px-4 py-3 flex items-center justify-between bg-white">
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8 border border-gray-200">
          {authorAvatar ? (
            <>
              {!avatarLoaded && (
                <Skeleton className="absolute inset-0 rounded-full bg-gray-100" />
              )}
              <AvatarImage 
                src={proxyFn(authorAvatar)} 
                onLoad={() => setAvatarLoaded(true)}
                className={avatarLoaded ? 'opacity-100' : 'opacity-0'}
              />
            </>
          ) : null}
          <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
            {avatarInitial}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900 leading-tight">
            {displayName}
          </span>
          {subtitle && (
            <span className="text-xs text-gray-500">{subtitle}</span>
          )}
        </div>
      </div>
      
      {/* View Profile button styled like Instagram */}
      <a
        href={postUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-1.5 bg-[#0095f6] hover:bg-[#1877f2] text-white text-sm font-semibold rounded-md transition-colors"
      >
        View profile
      </a>
    </div>
  );
};
