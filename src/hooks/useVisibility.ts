import { useEffect, useState, RefObject } from 'react';

export const useVisibility = (
  ref: RefObject<HTMLElement>,
  options?: IntersectionObserverInit
): boolean => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options?.threshold, options?.root, options?.rootMargin]);

  return isVisible;
};
