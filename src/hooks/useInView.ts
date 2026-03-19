import { useEffect, useState, RefObject } from 'react';

/**
 * Lightweight hook that tracks whether an element is in the viewport.
 * Returns `true` when >= `threshold` fraction is visible within `rootMargin`.
 */
export function useInView(
  ref: RefObject<HTMLElement | null>,
  { threshold = 0.2, rootMargin = '0px' }: { threshold?: number; rootMargin?: string } = {}
): boolean {
  const [inView, setInView] = useState(true); // default true to avoid flash

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin]);

  return inView;
}
