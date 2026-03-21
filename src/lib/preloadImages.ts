// High-performance image preloading for instant display
const imageCache = new Set<string>();
const linkPreloadCache = new Set<string>();
const pendingPreloads = new Map<string, Promise<void>>();

// High-priority preload using <link rel="preload"> - browser fetches with highest priority
export const preloadImageHighPriority = (src: string | null | undefined): void => {
  if (!src || linkPreloadCache.has(src)) return;
  
  // Avoid duplicate link elements
  linkPreloadCache.add(src);
  
  // Create <link rel="preload"> for highest priority
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.fetchPriority = 'high';
  document.head.appendChild(link);
  
  // Also add to Image cache for browsers that don't support link preload well
  if (!imageCache.has(src)) {
    imageCache.add(src);
    const img = new Image();
    img.src = src;
  }
};

// Standard preload using Image object - good for background loading
export const preloadImage = (src: string | null | undefined): void => {
  if (!src || imageCache.has(src)) return;
  
  imageCache.add(src);
  const img = new Image();
  img.src = src;
};

// Preload with promise tracking for batch completion
export const preloadImageWithPromise = (src: string | null | undefined): Promise<void> => {
  if (!src) return Promise.resolve();
  if (imageCache.has(src)) return Promise.resolve();
  
  // Return existing promise if already loading
  const existing = pendingPreloads.get(src);
  if (existing) return existing;
  
  imageCache.add(src);
  
  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      pendingPreloads.delete(src);
      resolve();
    };
    img.onerror = () => {
      pendingPreloads.delete(src);
      resolve(); // Resolve anyway to not block batch
    };
    img.src = src;
  });
  
  pendingPreloads.set(src, promise);
  return promise;
};

export const preloadImages = (urls: (string | null | undefined)[]): void => {
  urls.forEach(preloadImage);
};

// AGGRESSIVE preload - load ALL images immediately without waiting
// Used on login/feed load for instant scroll experience
export const preloadAllFeedImages = (posts: Array<{
  profiles?: { avatar_url?: string | null };
  thumbnail_url?: string | null;
  media_url?: string | null;
}>): void => {
  // Use requestIdleCallback for non-blocking batch loading
  const loadBatch = (startIdx: number) => {
    const batchSize = 20; // Larger batches for faster coverage
    const endIdx = Math.min(startIdx + batchSize, posts.length);
    
    for (let i = startIdx; i < endIdx; i++) {
      const post = posts[i];
      if (post.profiles?.avatar_url) preloadImage(post.profiles.avatar_url);
      if (post.thumbnail_url) preloadImage(post.thumbnail_url);
      // Only preload media_url if it's a direct image
      if (post.media_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        preloadImage(post.media_url);
      }
    }
    
    // Continue with next batch immediately
    if (endIdx < posts.length) {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => loadBatch(endIdx), { timeout: 50 });
      } else {
        setTimeout(() => loadBatch(endIdx), 0);
      }
    }
  };
  
  // Start loading immediately
  if (posts.length > 0) {
    // First 10 posts: high priority for instant display
    posts.slice(0, 10).forEach((post, index) => {
      const isHighPriority = index < 6;
      const preloadFn = isHighPriority ? preloadImageHighPriority : preloadImage;
      if (post.profiles?.avatar_url) preloadFn(post.profiles.avatar_url);
      if (post.thumbnail_url) preloadFn(post.thumbnail_url);
    });
    
    // Rest: background load all remaining with tighter scheduling
    if (posts.length > 10) {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => loadBatch(10), { timeout: 30 });
      } else {
        setTimeout(() => loadBatch(10), 0);
      }
    }
  }
};

// Preload feed post images with priority handling
// First few posts get high priority, rest get normal priority
export const preloadFeedImages = (posts: Array<{
  profiles?: { avatar_url?: string | null };
  thumbnail_url?: string | null;
  media_url?: string | null;
}>): void => {
  // Use aggressive preloading for ALL posts
  preloadAllFeedImages(posts);
};

// Preload profile images (high priority - user's own data)
export const preloadProfileImages = (profile: {
  avatar_url?: string | null;
  cover_url?: string | null;
} | null): void => {
  if (!profile) return;
  if (profile.avatar_url) preloadImageHighPriority(profile.avatar_url);
  if (profile.cover_url) preloadImageHighPriority(profile.cover_url);
};

// Preload images ahead of scroll - call this when user is nearing end of visible content
export const preloadNextBatch = (posts: Array<{
  profiles?: { avatar_url?: string | null };
  thumbnail_url?: string | null;
  media_url?: string | null;
}>, startIndex: number, count: number = 5): void => {
  const batch = posts.slice(startIndex, startIndex + count);
  batch.forEach(post => {
    if (post.profiles?.avatar_url) preloadImage(post.profiles.avatar_url);
    if (post.thumbnail_url) preloadImage(post.thumbnail_url);
  });
};

// Check if an image is already cached/preloaded
export const isImageCached = (src: string | null | undefined): boolean => {
  if (!src) return false;
  return imageCache.has(src) || linkPreloadCache.has(src);
};
