import { useState, useRef, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface NativeCardMediaProps {
  mediaType: 'video' | 'image' | 'text' | 'carousel';
  mediaUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  title?: string;
  proxyFn: (url?: string) => string;
}

export const NativeCardMedia = ({
  mediaType,
  mediaUrl,
  thumbnailUrl,
  caption,
  title,
  proxyFn,
}: NativeCardMediaProps) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  // Text-only posts
  if (mediaType === 'text') {
    return (
      <div className="w-full aspect-square flex items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <p className="text-gray-900 text-lg text-center leading-relaxed font-light">
          {caption || title}
        </p>
      </div>
    );
  }

  // Video posts - always show thumbnail with play button, click opens in new tab
  if (mediaType === 'video') {
    const posterUrl = proxyFn(thumbnailUrl || mediaUrl);
    
    return (
      <div className="relative w-full bg-black">
        {/* Shimmer loading skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0">
            <Skeleton className="w-full h-full bg-zinc-800" />
          </div>
        )}
        
        <img
          src={posterUrl}
          alt={title || 'Video thumbnail'}
          className={`w-full h-auto max-h-[600px] object-contain transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        
        {/* Play button overlay */}
        {imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <div className="w-0 h-0 border-l-[22px] border-l-white border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent ml-1.5" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Image posts
  const imageUrl = proxyFn(mediaUrl || thumbnailUrl);

  return (
    <div className="relative w-full bg-gray-50">
      {/* Shimmer loading skeleton */}
      {!imageLoaded && (
        <div className="absolute inset-0">
          <Skeleton className="w-full h-full bg-gray-200" />
        </div>
      )}
      
      {/* Actual image - natural aspect ratio */}
      {!imageError ? (
        <img
          src={imageUrl}
          alt={title || 'Post media'}
          className={`w-full h-auto max-h-[600px] object-contain transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      ) : (
        <div className="w-full aspect-square flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-400">
            <p className="text-sm">Image unavailable</p>
          </div>
        </div>
      )}
    </div>
  );
};
