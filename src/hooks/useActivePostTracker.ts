import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Tracks which posts are "active" (near the viewport) for smart hydration control.
 * Posts that move far off-screen are marked inactive so they can revert to thumbnail state.
 */
export const useActivePostTracker = (postIds: string[]) => {
  const [activePostIds, setActivePostIds] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsRef = useRef<Map<string, Element>>(new Map());
  
  // Setup intersection observer with generous margin
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setActivePostIds(prev => {
          const next = new Set(prev);
          
          entries.forEach(entry => {
            const postId = entry.target.getAttribute('data-post-id');
            if (!postId) return;
            
            if (entry.isIntersecting) {
              next.add(postId);
            } else {
              next.delete(postId);
            }
          });
          
          // Only update if actually changed
          if (next.size !== prev.size || ![...next].every(id => prev.has(id))) {
            return next;
          }
          return prev;
        });
      },
      {
        // Large margin: posts stay "active" until they're 1500px off-screen
        // This prevents dehydration during normal scroll, only triggers for far-away posts
        rootMargin: '1500px',
        threshold: 0,
      }
    );
    
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);
  
  // Register a post element for tracking
  const registerPost = useCallback((postId: string) => {
    return (element: HTMLDivElement | null) => {
      const observer = observerRef.current;
      if (!observer) return;
      
      // Unobserve previous element if exists
      const prevElement = elementsRef.current.get(postId);
      if (prevElement) {
        observer.unobserve(prevElement);
      }
      
      // Observe new element
      if (element) {
        element.setAttribute('data-post-id', postId);
        elementsRef.current.set(postId, element);
        observer.observe(element);
      } else {
        elementsRef.current.delete(postId);
      }
    };
  }, []);
  
  const isActive = useCallback((postId: string) => {
    return activePostIds.has(postId);
  }, [activePostIds]);
  
  return { registerPost, isActive };
};
