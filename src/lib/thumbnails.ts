import type { PlatformPost } from "@/hooks/useUserPlatformPosts";

const extractYouTubeId = (url?: string | null): string | null => {
  if (!url) return null;
  const match = url.match(
    /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]{11}).*/
  );
  return match?.[1] ?? null;
};

export function getPostThumbnail(post: PlatformPost): string | null {
  // 1) Use stored thumbnail if available
  if (post.thumbnail_url) return post.thumbnail_url;

  // 2) YouTube - generate thumbnail from video URL
  if (post.platform === "youtube" && post.media_url) {
    const videoId = extractYouTubeId(post.media_url);
    if (videoId) return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  // 3) For direct image URLs (not social platform URLs)
  if (post.media_type === "image" && post.media_url) {
    // Only use media_url if it's a direct image URL (not Instagram/FB/etc)
    const isDirectImage = !post.media_url.includes('instagram.com') &&
                          !post.media_url.includes('facebook.com') &&
                          !post.media_url.includes('twitter.com') &&
                          !post.media_url.includes('x.com') &&
                          !post.media_url.includes('reddit.com');
    if (isDirectImage) return post.media_url;
  }

  // 4) No reliable thumbnail available
  return null;
}
