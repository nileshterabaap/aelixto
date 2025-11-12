function decodeHtmlEntities(text: string): string {
  const txt = document.createElement("textarea");
  txt.innerHTML = text;
  return txt.value;
}

export function getPostThumb(p: {
  platform?: string | null;
  thumbnail_url?: string | null;   // server field
  thumbnailUrl?: string | null;    // legacy/feed field
  media_url?: string | null;       // server field
  mediaUrl?: string | null;        // legacy/feed field
}) {
  const platform = (p.platform || "").toLowerCase();
  const tu = p.thumbnail_url || p.thumbnailUrl;
  const mu = p.media_url || p.mediaUrl;

  // 1) server-derived thumbnail wins (decode HTML entities first)
  if (tu) return decodeHtmlEntities(tu);

  // 2) platform-based derivations used in Feed
  if (platform === "youtube" && mu) {
    const id =
      (mu.match(/(?:v=|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/) || [])[1];
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  // 3) direct image media
  if (mu && /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(mu)) return mu;

  // 4) safe placeholder
  return "/placeholder.svg";
}

/** Optional proxy helper; if /api/img-proxy exists use it, else return original. */
export function maybeProxy(url?: string | null, w = 480) {
  if (!url) return "/placeholder.svg";
  // Don't proxy local/relative paths
  if (url.startsWith("/")) return url;
  
  try { 
    new URL(url); 
  } catch { 
    return "/placeholder.svg"; 
  }
  
  // Don't proxy CDN URLs that work fine directly (Instagram, Facebook, YouTube, etc.)
  const cdnDomains = [
    'cdninstagram.com',
    'fbcdn.net', 
    'ytimg.com',
    'googleusercontent.com',
    'twimg.com'
  ];
  
  if (cdnDomains.some(domain => url.includes(domain))) {
    return url; // Use CDN URLs directly
  }
  
  // For other external URLs, use proxy if available
  const hasProxy = true;
  return hasProxy ? `/api/img-proxy?u=${encodeURIComponent(url)}&w=${w}` : url;
}
