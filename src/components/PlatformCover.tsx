import { memo } from 'react';
import { Heart, MessageCircle, Send, Bookmark, Play } from 'lucide-react';
import instagramIcon from '@/assets/platforms/instagram.svg';
import youtubeIcon from '@/assets/platforms/youtube.svg';

interface PlatformCoverProps {
  platform?: string;
  thumbnailUrl?: string | null;
  imageLoaded: boolean;
  imageError: boolean;
  onImageLoad: () => void;
  onImageError: () => void;
  onPlay: () => void;
  originalUrl?: string;
  authorName?: string;
  authorAvatar?: string;
  aspectClass: string;
}

/** Lightweight HTML/CSS overlay mimicking native platform embed chrome */
export const PlatformCover = memo(({
  platform,
  thumbnailUrl,
  imageLoaded,
  imageError,
  onImageLoad,
  onImageError,
  onPlay,
  originalUrl,
  authorName,
  authorAvatar,
  aspectClass,
}: PlatformCoverProps) => {

  const openOriginal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (originalUrl) window.open(originalUrl, '_blank', 'noopener');
  };

  if (platform === 'instagram') {
    return (
      <div className="relative w-full flex flex-col bg-white dark:bg-[#262626]">
        {/* Instagram top bar */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
          onClick={openOriginal}
        >
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt=""
              className="w-8 h-8 rounded-full object-cover ring-2 ring-pink-500 ring-offset-1"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-yellow-400" />
          )}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-black dark:text-white truncate block">
              {authorName || 'Instagram'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Original audio</span>
          </div>
          <button
            className="px-4 py-1.5 bg-[#0095f6] text-white text-sm font-semibold rounded-lg hover:bg-[#1877f2] transition-colors"
            onClick={openOriginal}
          >
            View profile
          </button>
        </div>

        {/* Thumbnail with centered play */}
        <div
          className={`relative w-full bg-black ${aspectClass} cursor-pointer`}
          onClick={onPlay}
        >
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted animate-shimmer" />
          )}
          {thumbnailUrl && !imageError && (
            <img
              src={thumbnailUrl}
              alt="Content preview"
              className={`w-full h-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={onImageLoad}
              onError={onImageError}
              loading="eager"
              decoding="async"
            />
          )}
          {(!thumbnailUrl || imageError) && (
            <div className="absolute inset-0 bg-black" />
          )}
          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </div>
        </div>

        {/* Instagram bottom bar */}
        <div className="px-3 pt-2" onClick={openOriginal}>
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0095f6] text-sm font-normal hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View more on Instagram
          </a>
        </div>
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 mt-2 cursor-pointer" onClick={openOriginal}>
          <div className="flex items-center gap-4">
            <Heart className="w-6 h-6 text-black dark:text-white" />
            <MessageCircle className="w-6 h-6 text-black dark:text-white" />
            <Send className="w-6 h-6 text-black dark:text-white" />
          </div>
          <Bookmark className="w-6 h-6 text-black dark:text-white" />
        </div>
        <div className="px-3 pb-2 border-t border-gray-200 dark:border-gray-700 cursor-pointer" onClick={openOriginal}>
          <span className="text-xs text-gray-500 dark:text-gray-400 py-2 block">Add a comment...</span>
        </div>
      </div>
    );
  }

  if (platform === 'youtube') {
    return (
      <div
        className={`relative w-full bg-black cursor-pointer ${aspectClass}`}
        onClick={onPlay}
      >
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted animate-shimmer" />
        )}
        {thumbnailUrl && !imageError && (
          <img
            src={thumbnailUrl}
            alt="Content preview"
            className={`w-full h-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={onImageLoad}
            onError={onImageError}
            loading="eager"
            decoding="async"
          />
        )}
        {(!thumbnailUrl || imageError) && (
          <div className="absolute inset-0 bg-black" />
        )}
        {/* YouTube-style play button */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[68px] h-[48px] rounded-xl bg-red-600/90 flex items-center justify-center shadow-lg">
            <Play className="w-7 h-7 text-white fill-white ml-0.5" />
          </div>
        </div>
        {/* YouTube bottom gradient bar */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      </div>
    );
  }

  // Default: generic cover with play button (TikTok, Facebook, Spotify, etc.)
  return (
    <div
      className={`relative w-full bg-black cursor-pointer ${aspectClass}`}
      onClick={onPlay}
    >
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted-foreground/10 to-muted animate-shimmer" />
      )}
      {thumbnailUrl && !imageError && (
        <img
          src={thumbnailUrl}
          alt="Content preview"
          className={`w-full h-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={onImageLoad}
          onError={onImageError}
          loading="eager"
          decoding="async"
        />
      )}
      {(!thumbnailUrl || imageError) && (
        <div className="absolute inset-0 bg-black" />
      )}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <Play className="w-8 h-8 text-white fill-white ml-1" />
        </div>
      </div>
    </div>
  );
});

PlatformCover.displayName = 'PlatformCover';
