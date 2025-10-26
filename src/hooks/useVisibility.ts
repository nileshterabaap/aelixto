import { useEffect, useState, RefObject, useRef } from 'react';

export const useVisibility = (
  elementRef: RefObject<HTMLElement>,
  threshold: number = 0.1
): boolean => {
  const [isVisible, setIsVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementIdRef = useRef<symbol>(Symbol('visibility-element'));

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      setIsVisible(false);
      return;
    }

    // Store element ID for this instance
    const currentElementId = elementIdRef.current;

    // Clean up existing observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Create new observer with error handling
    try {
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          // Only update if this is still the current element
          if (currentElementId === elementIdRef.current) {
            setIsVisible(entry.isIntersecting);
          }
        },
        { 
          threshold,
          rootMargin: '50px' // Load slightly before visible
        }
      );

      observerRef.current.observe(element);
    } catch (err) {
      console.error('[useVisibility] Error creating observer:', err);
      // Fallback to visible if observer fails
      setIsVisible(true);
    }

    return () => {
      if (observerRef.current) {
        try {
          observerRef.current.disconnect();
        } catch (err) {
          console.error('[useVisibility] Error disconnecting observer:', err);
        }
        observerRef.current = null;
      }
    };
  }, [elementRef, threshold]);

  return isVisible;
};
