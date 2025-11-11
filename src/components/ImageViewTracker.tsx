import { useEffect, useRef, useState } from 'react';
import { useImageViewTracking } from '@/hooks/useViewTracking';

interface ImageViewTrackerProps {
  postId: string;
  children: React.ReactNode;
  threshold?: number;
  viewDuration?: number;
}

/**
 * Wraps an image to track 2+ second views using IntersectionObserver
 * Only counts once per post per hour (handled by backend)
 */
export const ImageViewTracker = ({ 
  postId, 
  children, 
  threshold = 0.5,
  viewDuration = 2000 
}: ImageViewTrackerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasTracked, setHasTracked] = useState(false);
  const trackImageView = useImageViewTracking();

  useEffect(() => {
    if (!containerRef.current || hasTracked) return;

    console.log('[ImageViewTracker] Setting up observer for post:', postId);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            console.log('[ImageViewTracker] Image visible:', postId, 'ratio:', entry.intersectionRatio);
            // Start timer when image becomes visible
            if (!timerRef.current) {
              console.log('[ImageViewTracker] Starting 2s timer for:', postId);
              timerRef.current = setTimeout(async () => {
                if (!hasTracked) {
                  console.log('[ImageViewTracker] 2s elapsed, tracking view for:', postId);
                  const success = await trackImageView(postId);
                  console.log('[ImageViewTracker] Track result:', success);
                  if (success) {
                    setHasTracked(true);
                  }
                }
              }, viewDuration);
            }
          } else {
            console.log('[ImageViewTracker] Image NOT visible or below threshold:', postId);
            // Cancel timer if image leaves viewport
            if (timerRef.current) {
              console.log('[ImageViewTracker] Canceling timer for:', postId);
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
          }
        });
      },
      { threshold }
    );

    observer.observe(containerRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      observer.disconnect();
    };
  }, [postId, hasTracked, threshold, viewDuration, trackImageView]);

  return <div ref={containerRef}>{children}</div>;
};
