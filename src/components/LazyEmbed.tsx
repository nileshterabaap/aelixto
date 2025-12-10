import { useState, useEffect, useRef, ReactNode } from 'react';
import { Skeleton } from './ui/skeleton';

interface LazyEmbedProps {
  children: ReactNode;
  thumbnailUrl?: string | null;
  previewTitle?: string | null;
  previewText?: string | null;
  platform?: string;
  mediaUrl?: string | null;
  autoLoad?: boolean;
}

export const LazyEmbed = ({
  children,
  thumbnailUrl,
  autoLoad = false
}: LazyEmbedProps) => {
  const [shouldLoad, setShouldLoad] = useState(autoLoad);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-load embeds when they come into view
  useEffect(() => {
    if (!containerRef.current || autoLoad || shouldLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
          }
        });
      },
      {
        rootMargin: '400px', // Start loading earlier
        threshold: 0.01
      }
    );

    observer.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, [autoLoad, shouldLoad]);

  // Detect when embed iframe is loaded
  useEffect(() => {
    if (!shouldLoad || !containerRef.current) return;

    const checkForIframe = () => {
      const iframe = containerRef.current?.querySelector('iframe');
      if (iframe) {
        setEmbedLoaded(true);
        return true;
      }
      return false;
    };

    // Check immediately and then periodically
    if (checkForIframe()) return;

    const interval = setInterval(() => {
      if (checkForIframe()) {
        clearInterval(interval);
      }
    }, 200);

    // Stop checking after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setEmbedLoaded(true); // Show whatever we have
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [shouldLoad]);

  // Show thumbnail as placeholder while loading
  const showPlaceholder = !shouldLoad || !embedLoaded;

  return (
    <div ref={containerRef} className="relative">
      {/* Placeholder - thumbnail or skeleton */}
      {showPlaceholder && (
        <div className="absolute inset-0 z-10">
          {thumbnailUrl ? (
            <div className="w-full h-full min-h-[300px] bg-muted rounded-2xl overflow-hidden">
              <img 
                src={thumbnailUrl} 
                alt="" 
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          ) : (
            <Skeleton className="w-full min-h-[300px] rounded-2xl" />
          )}
        </div>
      )}
      
      {/* Actual embed content */}
      <div className={showPlaceholder ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}>
        {shouldLoad && children}
      </div>
    </div>
  );
};
