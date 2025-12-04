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

/** 
 * Proxy ALL external images through our edge function to:
 * 1. Avoid CORS issues
 * 2. Handle expired CDN tokens (Instagram/Facebook URLs expire)
 * 3. Provide caching
 */
export function maybeProxy(url?: string | null, w = 480) {
  if (!url) return "/placeholder.svg";
  
  // Don't proxy local/relative paths or placeholders
  if (url.startsWith("/")) return url;
  
  // Validate URL
  try { 
    new URL(url); 
  } catch { 
    return "/placeholder.svg"; 
  }
  
  // Only allow HTTPS URLs through proxy
  if (!url.startsWith("https://")) {
    return "/placeholder.svg";
  }
  
  // YouTube thumbnails are stable and don't expire - use directly
  if (url.includes('ytimg.com') || url.includes('img.youtube.com')) {
    return url;
  }
  
  // Supabase storage URLs are permanent and don't need proxying
  // Check for both patterns: supabase.co/storage and .supabase.co/storage
  if (url.includes('.supabase.co/storage') || url.includes('supabase.co/storage/')) {
    return url;
  }
  
  // Unsplash URLs are stable and don't need proxying
  if (url.includes('unsplash.com')) {
    return url;
  }
  
  // For now, return URLs directly without proxying to avoid auth-bridge redirect issues
  // The img-proxy edge function can be used in production when properly deployed
  return url;
}
