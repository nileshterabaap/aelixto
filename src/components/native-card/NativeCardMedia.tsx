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

  // Video posts
  if (mediaType === 'video' && mediaUrl && mediaUrl.includes('.mp4')) {
    return (
      <div className="relative aspect-[9/16] max-h-[500px] bg-black">
        <video
          ref={videoRef}
          src={mediaUrl}
          poster={proxyFn(thumbnailUrl)}
          className="w-full h-full object-contain cursor-pointer"
          onClick={handleVideoClick}
          loop
          playsInline
          muted
        />
        {!isVideoPlaying && (
          <div 
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={handleVideoClick}
          >
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              <div className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Image posts (including video thumbnails)
  const imageUrl = proxyFn(mediaUrl || thumbnailUrl);
  const isVideoThumbnail = mediaType === 'video';

  return (
    <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
      {/* Shimmer loading skeleton */}
      {!imageLoaded && (
        <Skeleton className="absolute inset-0 w-full h-full bg-gray-100" />
      )}
      
      {/* Actual image */}
      {!imageError ? (
        <img
          src={imageUrl}
          alt={title || 'Post media'}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-400">
            <p className="text-sm">Image unavailable</p>
          </div>
        </div>
      )}

      {/* Video indicator for video posts showing thumbnail */}
      {isVideoThumbnail && imageLoaded && !imageError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <div className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
          </div>
        </div>
      )}
    </div>
  );
};
