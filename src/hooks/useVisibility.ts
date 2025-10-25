import { useEffect, useState, RefObject } from 'react';

export const useVisibility = (
  ref: RefObject<HTMLElement>,
  threshold: number = 0.1
): boolean => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []); // Empty dependencies - observer is set up once

  return isVisible;
};
