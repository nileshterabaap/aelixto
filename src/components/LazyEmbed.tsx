import { useState, useEffect, useRef, ReactNode } from 'react';
import { Play } from 'lucide-react';
import { LitePreviewCard } from './LitePreviewCard';

interface LazyEmbedProps {
  children: ReactNode;
  thumbnailUrl?: string | null;
  previewTitle?: string | null;
  previewText?: string | null;
  platform?: string;
  mediaUrl?: string;
  autoLoad?: boolean;
}

// Check if thumbnail is a supabase URL (which may be empty for IG/FB)
const isExpirablePlatformWithBrokenThumb = (platform?: string, url?: string | null) => {
  if (!platform || !url) return false;
  const isExpirable = platform === 'instagram' || platform === 'facebook';
  const isSupabaseUrl = url.includes('supabase.co/storage');
  return isExpirable && isSupabaseUrl;
};

// Get platform gradient for placeholder
const getPlatformGradient = (platform?: string) => {
  switch (platform) {
    case 'instagram': return 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400';
    case 'facebook': return 'bg-gradient-to-br from-blue-600 to-blue-400';
    case 'youtube': return 'bg-gradient-to-br from-red-600 to-red-400';
    case 'tiktok': return 'bg-gradient-to-br from-black to-gray-800';
    default: return 'bg-gradient-to-br from-muted to-muted-foreground/20';
  }
};

export const LazyEmbed = ({
  children,
  thumbnailUrl,
  previewTitle,
  previewText,
  platform,
  mediaUrl,
  autoLoad = false
}: LazyEmbedProps) => {
  const [shouldLoad, setShouldLoad] = useState(autoLoad);
  const [isInView, setIsInView] = useState(false);
  const [imageError, setImageError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Skip broken supabase thumbnails for Instagram/Facebook
  const skipThumb = isExpirablePlatformWithBrokenThumb(platform, thumbnailUrl);
  const effectiveThumbUrl = skipThumb ? null : thumbnailUrl;

  useEffect(() => {
    if (!containerRef.current || autoLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            if (platform === 'medium' || platform === 'blog' || platform === 'quora') {
              setShouldLoad(true);
            }
          }
        });
      },
      {
        rootMargin: '200px',
        threshold: 0.1
      }
    );

    observer.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [autoLoad, platform]);

  const handleLoadEmbed = () => {
    setShouldLoad(true);
  };

  const hasPreview = previewTitle || previewText || effectiveThumbUrl;
  const isVideoPlatform = platform === 'youtube' || platform === 'tiktok' || 
                          platform === 'instagram' || platform === 'facebook';

  // For Instagram/Facebook without valid thumbnail, auto-load immediately
  const shouldAutoLoadDueToMissingThumb = isVideoPlatform && skipThumb && !shouldLoad;
  
  useEffect(() => {
    if (shouldAutoLoadDueToMissingThumb && isInView) {
      setShouldLoad(true);
    }
  }, [shouldAutoLoadDueToMissingThumb, isInView]);

  return (
    <div ref={containerRef}>
      {!shouldLoad && hasPreview && !imageError ? (
        <div className="relative">
          {isVideoPlatform && effectiveThumbUrl ? (
            <div 
              className="relative cursor-pointer group rounded-2xl overflow-hidden"
              onClick={handleLoadEmbed}
            >
              <img
                src={effectiveThumbUrl}
                alt={previewTitle || 'Video thumbnail'}
                className="w-full aspect-video object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                <div className="bg-primary text-primary-foreground rounded-full p-4 group-hover:scale-110 transition-transform">
                  <Play className="h-8 w-8" fill="currentColor" />
                </div>
              </div>
            </div>
          ) : isVideoPlatform && skipThumb ? (
            // Platform gradient placeholder for IG/FB with broken thumbs
            <div 
              className={`relative cursor-pointer group rounded-2xl overflow-hidden aspect-video ${getPlatformGradient(platform)} flex items-center justify-center`}
              onClick={handleLoadEmbed}
            >
              <div className="text-center">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 mb-2 inline-block group-hover:scale-110 transition-transform">
                  <Play className="h-8 w-8 text-white" fill="currentColor" />
                </div>
                <p className="text-white/90 text-sm font-medium capitalize">{platform}</p>
              </div>
            </div>
          ) : (
            <LitePreviewCard
              url={mediaUrl || ''}
              title={previewTitle}
              image={effectiveThumbUrl}
              text={previewText}
              platform={platform}
              onLoadFull={handleLoadEmbed}
            />
          )}
        </div>
      ) : shouldLoad || isInView ? (
        children
      ) : (
        <div className="w-full aspect-video bg-muted rounded-2xl animate-pulse" />
      )}
    </div>
  );
};