import { useState, useEffect, useRef, ReactNode } from 'react';
import { SkeletonGate } from '@/components/embeds/SkeletonGate';

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
  platform,
  autoLoad = false
}: LazyEmbedProps) => {
  const [shouldLoad, setShouldLoad] = useState(autoLoad);
  const containerRef = useRef<HTMLDivElement>(null);

  // Single IntersectionObserver — loads when within ~2000px of viewport
  useEffect(() => {
    if (!containerRef.current || autoLoad || shouldLoad) return;

    const preloadObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldLoad(true);
          preloadObserver.disconnect();
        }
      },
      {
        rootMargin: '2000px',
        threshold: 0.01
      }
    );

    preloadObserver.observe(containerRef.current);
    return () => preloadObserver.disconnect();
  }, [autoLoad, shouldLoad]);

  // Content stays in DOM once loaded, wrapped in SkeletonGate for smooth fade-in.
  return (
    <div ref={containerRef} style={{ contain: 'layout paint' }}>
      {shouldLoad && (
        <SkeletonGate platform={platform}>
          {children}
        </SkeletonGate>
      )}
    </div>
  );
};
