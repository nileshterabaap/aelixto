import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface NativeCardMediaProps {
  mediaType: 'video' | 'image' | 'text' | 'carousel';
  platform?: string;
  postUrl?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  title?: string;
  proxyFn: (url?: string) => string;
}

function getAspectClass(platform?: string) {
  const p = (platform || '').toLowerCase();
  // Match the most common “official embed” feeling: tall media for IG/TikTok.
  if (p === 'instagram' || p === 'tiktok') return 'aspect-[4/5]';
  if (p === 'youtube') return 'aspect-video';
  return 'aspect-square';
}

export const NativeCardMedia = ({
  mediaType,
  platform,
  postUrl,
  mediaUrl,
  thumbnailUrl,
  caption,
  title,
  proxyFn,
}: NativeCardMediaProps) => {
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const aspectClass = useMemo(() => getAspectClass(platform), [platform]);

  const handleLoad = () => {
    setMediaLoaded(true);
  };

  const handleError = () => {
    setMediaError(true);
    setMediaLoaded(true);
  };

  // Text-only posts
  if (mediaType === 'text') {
    return (
      <div className={`w-full ${aspectClass} flex items-center justify-center p-8 bg-muted`}>
        <p className="text-foreground text-lg text-center leading-relaxed font-light">
          {caption || title}
        </p>
      </div>
    );
  }

  // Video posts
  // Important: Outstand often returns the *post page URL* (not a direct mp4), so inline playback
  // isn’t possible reliably. To match “tap to play” behavior, we open the original post URL.
  if (mediaType === 'video') {
    const posterUrl = proxyFn(thumbnailUrl || mediaUrl);

    return (
      <button
        type="button"
        onClick={() => {
          const href = postUrl || mediaUrl;
          if (href) window.open(href, '_blank', 'noopener,noreferrer');
        }}
        className={`relative w-full ${aspectClass} overflow-hidden bg-muted block text-left`}
        aria-label={title ? `Play video: ${title}` : 'Play video'}
      >
        {!mediaLoaded && (
          <div className="absolute inset-0">
            <Skeleton className="w-full h-full" />
          </div>
        )}

        {!mediaError ? (
          <img
            src={posterUrl}
            alt={title || 'Video thumbnail'}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              mediaLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleLoad}
            onError={handleError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Video unavailable</p>
          </div>
        )}

        {/* Play button overlay */}
        {mediaLoaded && !mediaError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-background/60 border border-border flex items-center justify-center backdrop-blur-sm">
              <div className="w-0 h-0 border-l-[22px] border-l-foreground border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent ml-1.5" />
            </div>
          </div>
        )}
      </button>
    );
  }

  // Image posts
  const imageUrl = proxyFn(mediaUrl || thumbnailUrl);

  return (
    <div className={`relative w-full ${aspectClass} overflow-hidden bg-muted`}>
      {!mediaLoaded && (
        <div className="absolute inset-0">
          <Skeleton className="w-full h-full" />
        </div>
      )}

      {!mediaError ? (
        <img
          src={imageUrl}
          alt={title || 'Post media'}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            mediaLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Image unavailable</p>
        </div>
      )}
    </div>
  );
};
