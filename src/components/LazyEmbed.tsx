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
  autoLoad?: boolean; // For non-video platforms like articles
}

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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || autoLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // For articles/blogs, auto-load when in view
            if (platform === 'medium' || platform === 'blog' || platform === 'quora') {
              setShouldLoad(true);
            }
          }
        });
      },
      {
        rootMargin: '200px', // Start loading a bit before it comes into view
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

  // Check if we have preview data
  const hasPreview = previewTitle || previewText || thumbnailUrl;
  
  // Determine if this is a video platform
  const isVideoPlatform = platform === 'youtube' || platform === 'tiktok' || 
                          platform === 'instagram' || platform === 'facebook';

  return (
    <div ref={containerRef}>
      {!shouldLoad && hasPreview ? (
        <div className="relative">
          {isVideoPlatform && thumbnailUrl ? (
            // Video thumbnail with play button
            <div 
              className="relative cursor-pointer group rounded-2xl overflow-hidden"
              onClick={handleLoadEmbed}
            >
              <img
                src={thumbnailUrl}
                alt={previewTitle || 'Video thumbnail'}
                className="w-full aspect-video object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                <div className="bg-primary text-primary-foreground rounded-full p-4 group-hover:scale-110 transition-transform">
                  <Play className="h-8 w-8" fill="currentColor" />
                </div>
              </div>
              {platform && (
                <div className="absolute top-3 left-3 px-2 py-1 bg-background/90 backdrop-blur-sm rounded-full text-xs font-medium border border-border capitalize">
                  {platform}
                </div>
              )}
            </div>
          ) : (
            // Article/link preview card
            <LitePreviewCard
              url={mediaUrl || ''}
              title={previewTitle}
              image={thumbnailUrl}
              text={previewText}
              platform={platform}
              onLoadFull={handleLoadEmbed}
            />
          )}
        </div>
      ) : shouldLoad || isInView ? (
        children
      ) : (
        // Placeholder while waiting to come into view
        <div className="w-full aspect-video bg-muted rounded-2xl animate-pulse" />
      )}
    </div>
  );
};