import { useState, useEffect, useRef, ReactNode } from 'react';

interface LazyEmbedProps {
  children: ReactNode;
  thumbnailUrl?: string | null;
  previewTitle?: string | null;
  previewText?: string | null;
  platform?: string;
  mediaUrl?: string;
  autoLoad?: boolean;
}

export const LazyEmbed = ({
  children,
  autoLoad = false
}: LazyEmbedProps) => {
  const [shouldLoad, setShouldLoad] = useState(autoLoad);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-load embeds when they come into view - no intermediate tap states
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
  }, [autoLoad, shouldLoad]);

  return (
    <div ref={containerRef}>
      {shouldLoad ? (
        children
      ) : (
        <div className="w-full aspect-video bg-muted rounded-2xl animate-pulse" />
      )}
    </div>
  );
};
