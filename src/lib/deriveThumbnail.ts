/**
 * Derives a thumbnail URL from a post's media URL when no thumbnail is stored
 */
export function deriveThumbnailFromUrl(mediaUrl: string | null, platform?: string | null): string | null {
  if (!mediaUrl) return null;

  // YouTube - extract video ID and generate thumbnail
  if (platform === 'youtube' || mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) {
    const videoId = mediaUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }

  // For direct image URLs (not social platform URLs)
  if (!mediaUrl.includes('instagram.com') &&
      !mediaUrl.includes('facebook.com') &&
      !mediaUrl.includes('twitter.com') &&
      !mediaUrl.includes('x.com') &&
      !mediaUrl.includes('reddit.com') &&
      !mediaUrl.includes('tiktok.com') &&
      !mediaUrl.includes('pinterest.com')) {
    
    // Check if URL points to an image
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const urlLower = mediaUrl.toLowerCase();
    if (imageExtensions.some(ext => urlLower.includes(ext))) {
      return mediaUrl;
    }
  }

  return null;
}
