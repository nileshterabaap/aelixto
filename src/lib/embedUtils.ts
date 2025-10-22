// Platform detection and embed utilities

export type SocialPlatform = 
  | 'youtube' 
  | 'tiktok' 
  | 'instagram' 
  | 'reddit' 
  | 'twitter' 
  | 'pinterest' 
  | 'vimeo' 
  | 'soundcloud' 
  | 'spotify';

export interface PlatformDetection {
  platform: SocialPlatform;
  mediaType: 'image' | 'video' | 'audio';
  embedUrl?: string;
  postId?: string;
}

// YouTube utilities
export const getYouTubeVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const getYouTubeThumbnail = (url: string): string => {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
};

// Twitter/X utilities
export const getTwitterPostId = (url: string): string | null => {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
};

// TikTok utilities
export const getTikTokVideoId = (url: string): string | null => {
  const match = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
  return match ? match[1] : null;
};

// Pinterest utilities
export const getPinterestPinId = (url: string): string | null => {
  const match = url.match(/pinterest\.com\/pin\/(\d+)/);
  return match ? match[1] : null;
};

// Reddit utilities
export const getRedditPostInfo = (url: string): { subreddit: string; postId: string } | null => {
  const match = url.match(/reddit\.com\/r\/(\w+)\/comments\/(\w+)/);
  return match ? { subreddit: match[1], postId: match[2] } : null;
};

// Vimeo utilities
export const getVimeoVideoId = (url: string): string | null => {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

// SoundCloud utilities
export const isSoundCloudUrl = (url: string): boolean => {
  return url.includes('soundcloud.com');
};

// Spotify utilities
export const getSpotifyEmbedUrl = (url: string): string | null => {
  const match = url.match(/spotify\.com\/(track|episode|playlist|album)\/([a-zA-Z0-9]+)/);
  if (match) {
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
  }
  return null;
};

// Main platform detection
export const detectPlatform = (url: string): PlatformDetection | null => {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return { platform: 'youtube', mediaType: 'video', postId: getYouTubeVideoId(url) || undefined };
  }
  
  if (url.includes('twitter.com') || url.includes('x.com')) {
    return { platform: 'twitter', mediaType: 'image', postId: getTwitterPostId(url) || undefined };
  }
  
  if (url.includes('tiktok.com')) {
    return { platform: 'tiktok', mediaType: 'video', postId: getTikTokVideoId(url) || undefined };
  }
  
  if (url.includes('instagram.com')) {
    const mediaType = url.includes('/reel/') ? 'video' : 'image';
    return { platform: 'instagram', mediaType };
  }
  
  if (url.includes('pinterest.com')) {
    return { platform: 'pinterest', mediaType: 'image', postId: getPinterestPinId(url) || undefined };
  }
  
  if (url.includes('reddit.com')) {
    return { platform: 'reddit', mediaType: 'image' };
  }
  
  if (url.includes('vimeo.com')) {
    return { platform: 'vimeo', mediaType: 'video', postId: getVimeoVideoId(url) || undefined };
  }
  
  if (url.includes('soundcloud.com')) {
    return { platform: 'soundcloud', mediaType: 'audio' };
  }
  
  if (url.includes('spotify.com')) {
    const embedUrl = getSpotifyEmbedUrl(url);
    return { platform: 'spotify', mediaType: 'audio', embedUrl: embedUrl || undefined };
  }
  
  return null;
};

// Load external scripts
export const loadScript = (src: string, id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};