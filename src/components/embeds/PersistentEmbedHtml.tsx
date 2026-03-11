import { CSSProperties, useLayoutEffect, useRef } from 'react';

interface PersistentEmbedHtmlProps {
  cacheKey: string;
  html: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

const embedNodeCache = new Map<string, HTMLElement>();
const cacheOrder: string[] = [];
const MAX_CACHE_ENTRIES = 150;

const touchCacheKey = (key: string) => {
  const existingIndex = cacheOrder.indexOf(key);
  if (existingIndex !== -1) {
    cacheOrder.splice(existingIndex, 1);
  }
  cacheOrder.push(key);

  while (cacheOrder.length > MAX_CACHE_ENTRIES) {
    const evictedKey = cacheOrder.shift();
    if (evictedKey) {
      embedNodeCache.delete(evictedKey);
    }
  }
};

/**
 * Preserves rendered embed DOM nodes across unmount/remount cycles.
 * This prevents iframe reloads and expensive SDK work from running repeatedly.
 */
export const PersistentEmbedHtml = ({
  cacheKey,
  html,
  className,
  style,
  onClick,
}: PersistentEmbedHtmlProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cachedNode = embedNodeCache.get(cacheKey);
    if (cachedNode) {
      container.replaceChildren(cachedNode);
      touchCacheKey(cacheKey);
      return;
    }

    container.innerHTML = html;
  }, [cacheKey, html]);

  useLayoutEffect(() => {
    return () => {
      const container = containerRef.current;
      if (!container) return;

      const node = container.firstElementChild as HTMLElement | null;
      if (!node) return;

      embedNodeCache.set(cacheKey, node);
      touchCacheKey(cacheKey);
    };
  }, [cacheKey]);

  return <div ref={containerRef} className={className} style={style} onClick={onClick} />;
};
