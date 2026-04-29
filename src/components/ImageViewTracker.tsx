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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasTracked, setHasTracked] = useState(false);
  const trackImageView = useImageViewTracking();

  useEffect(() => {
    console.log('[ImageViewTracker] Mount', { postId, hasTracked });
    if (!containerRef.current || hasTracked) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          console.log('[ImageViewTracker] Intersection', { 
            postId, 
            isIntersecting: entry.isIntersecting, 
            intersectionRatio: entry.intersectionRatio,
            threshold 
          });
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            // Start timer when image becomes visible
            if (!timerRef.current) {
              console.log('[ImageViewTracker] Starting timer', { postId, viewDuration });
              timerRef.current = setTimeout(async () => {
                if (!hasTracked) {
                  console.log('[ImageViewTracker] Calling trackImageView', { postId });
                  const success = await trackImageView(postId);
                  console.log('[ImageViewTracker] Track result', { postId, success });
                  if (success) {
                    setHasTracked(true);
                  }
                }
              }, viewDuration);
            }
          } else {
            // Cancel timer if image leaves viewport
            if (timerRef.current) {
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
