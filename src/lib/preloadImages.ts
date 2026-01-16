// High-performance image preloading for instant display
const imageCache = new Set<string>();
const linkPreloadCache = new Set<string>();

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

export const preloadImages = (urls: (string | null | undefined)[]): void => {
  urls.forEach(preloadImage);
};

// Preload feed post images with priority handling
// First few posts get high priority, rest get normal priority
export const preloadFeedImages = (posts: Array<{
  profiles?: { avatar_url?: string | null };
  thumbnail_url?: string | null;
  media_url?: string | null;
}>): void => {
  posts.forEach((post, index) => {
    const isHighPriority = index < 3; // First 3 posts are above the fold
    const preloadFn = isHighPriority ? preloadImageHighPriority : preloadImage;
    
    // Avatars are always visible, prioritize them
    if (post.profiles?.avatar_url) {
      preloadFn(post.profiles.avatar_url);
    }
    
    // Thumbnails are crucial for perceived speed
    if (post.thumbnail_url) {
      preloadFn(post.thumbnail_url);
    }
    
    // Only preload media_url if it's an image
    if (post.media_url && post.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      preloadImage(post.media_url); // Lower priority for actual media
    }
  });
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
