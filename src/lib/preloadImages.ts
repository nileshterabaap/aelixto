// Preload images for instant display
const imageCache = new Set<string>();

export const preloadImage = (src: string | null | undefined): void => {
  if (!src || imageCache.has(src)) return;
  
  const img = new Image();
  img.src = src;
  imageCache.add(src);
};

export const preloadImages = (urls: (string | null | undefined)[]): void => {
  urls.forEach(preloadImage);
};

// Preload feed post images (avatars + thumbnails)
export const preloadFeedImages = (posts: Array<{
  profiles?: { avatar_url?: string | null };
  thumbnail_url?: string | null;
  media_url?: string | null;
}>): void => {
  const urls: (string | null | undefined)[] = [];
  
  posts.forEach(post => {
    if (post.profiles?.avatar_url) urls.push(post.profiles.avatar_url);
    if (post.thumbnail_url) urls.push(post.thumbnail_url);
    if (post.media_url && post.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      urls.push(post.media_url);
    }
  });
  
  preloadImages(urls);
};

// Preload profile images
export const preloadProfileImages = (profile: {
  avatar_url?: string | null;
  cover_url?: string | null;
} | null): void => {
  if (!profile) return;
  preloadImages([profile.avatar_url, profile.cover_url]);
};
