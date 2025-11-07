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
    if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  // 3) Use media_url if it's an image
  if (post.media_type === "image" && post.media_url) {
    return post.media_url;
  }

  // 4) No reliable thumbnail available
  return null;
}
