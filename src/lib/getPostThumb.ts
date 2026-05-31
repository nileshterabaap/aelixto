// Safely decode HTML entities using DOMParser (XSS-safe)
function decodeHtmlEntities(text: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  return doc.body.textContent || '';
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

  // 1) server-derived thumbnail wins (decode HTML entities first),
  //    BUT filter out misleading generic OG placeholders (e.g. Unsplash
  //    fallbacks scraped from Reddit /s/ share links). For platforms where
  //    the thumbnail should plausibly come from the platform itself, drop
  //    anything hosted on a clearly-foreign domain so the typographic
  //    TextCardThumbnail can take over instead of showing a wrong image.
  if (tu) {
    const decoded = decodeHtmlEntities(tu);
    if (isMisleadingThumbnail(platform, decoded)) {
      // Fall through to platform/media derivations or placeholder.
    } else {
      return decoded;
    }
  }

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
 * Returns true for thumbnails that are almost certainly NOT representative
 * of the actual post (e.g. Unsplash stock images served as OG fallback by
 * a link-resolver). When this returns true, callers should treat the post
 * as having no thumbnail and use the platform-branded text card instead.
 */
function isMisleadingThumbnail(platform: string, url: string): boolean {
  const lower = url.toLowerCase();
  // Generic stock image hosts are never a real post preview.
  if (lower.includes("images.unsplash.com") || lower.includes("source.unsplash.com")) {
    return true;
  }
  // For Reddit, thumbnails should come from reddit/redd.it/redditmedia/redditstatic
  // or from our own storage bucket. Anything else is a foreign OG scrape.
  if (platform === "reddit") {
    const allowed = [
      "reddit.com",
      "redd.it",
      "redditmedia.com",
      "redditstatic.com",
      "/storage/v1/object/public/post-thumbnails/",
      "post-thumbnails",
    ];
    if (!allowed.some((d) => lower.includes(d))) return true;
  }
  return false;
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
  
  // Only allow HTTPS URLs
  if (!url.startsWith("https://")) {
    return "/placeholder.svg";
  }
  
  // Return ALL URLs directly - no proxying needed
  // Supabase storage URLs are permanent and public
  // YouTube thumbnails are stable
  // Other URLs will work directly or show placeholder on error
  return url;
}
