// Safely decode HTML entities using DOMParser (XSS-safe)
function decodeHtmlEntities(text: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  return doc.body.textContent || '';
}

function sameUrl(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim();
}

function isDirectImageUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) ||
      host === "i.redd.it" ||
      host === "preview.redd.it" ||
      host.endsWith("redditmedia.com")
    );
  } catch {
    return false;
  }
}

function isRedditMediaHost(url?: string | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "i.redd.it" ||
      host === "preview.redd.it" ||
      host === "external-preview.redd.it" ||
      host.endsWith("redditmedia.com")
    );
  } catch {
    return false;
  }
}

function isTextOnlySocialAvatar(platform: string, url: string): boolean {
  const lower = url.toLowerCase();
  if ((platform === "twitter" || platform === "x") && lower.includes("pbs.twimg.com/profile_images/")) {
    return true;
  }
  if ((platform === "twitter" || platform === "x") && lower.includes("abs.twimg.com/")) {
    return true;
  }
  // Twitter's generic OG/summary card art (not the tweet's own media).
  if ((platform === "twitter" || platform === "x") && lower.includes("pbs.twimg.com/card_img/")) {
    return true;
  }
  if ((platform === "twitter" || platform === "x") && lower.includes("pbs.twimg.com/semantic_core_img/")) {
    return true;
  }
  if (platform === "threads" && isThreadsProfilePictureUrl(lower)) {
    return true;
  }
  return false;
}

function isThreadsProfilePictureUrl(lowerUrl: string): boolean {
  if (lowerUrl.includes("profile_pic")) return true;
  if (lowerUrl.includes("/t51.82787-19/")) return true;
  // Meta CDN profile-picture buckets all end in "-19" (t51.2885-19,
  // t51.82787-19, t51.30982-19, ...). Any Threads/IG CDN asset served from
  // one of those buckets is an avatar, never the post's own media.
  if (/\/t\d+\.[\d-]*-19\//.test(lowerUrl)) return true;
  if (/[?&]stp=[^&]*_19/.test(lowerUrl)) return true;
  if (lowerUrl.includes("cdninstagram.com") && lowerUrl.includes("-19/")) return true;
  if (lowerUrl.includes("fbcdn.net") && lowerUrl.includes("-19/")) return true;
  return false;
}

export function getPostThumb(p: {
  platform?: string | null;
  thumbnail_url?: string | null;   // server field
  thumbnailUrl?: string | null;    // legacy/feed field
  preview_image_url?: string | null;
  previewImageUrl?: string | null;
  media_url?: string | null;       // server field
  mediaUrl?: string | null;        // legacy/feed field
  // Aelixto post author's avatar — used to detect misleading OG scrapes
  // (e.g. Reddit posts whose thumbnail_url accidentally captured the poster's
  // Aelixto profile picture). When the stored thumbnail equals the user's
  // own avatar, treat it as no thumbnail.
  author_avatar_url?: string | null;
  profile_avatar_url?: string | null;
}): string | null {
  const platform = (p.platform || "").toLowerCase();
  const tu = p.thumbnail_url || p.thumbnailUrl;
  const piu = p.preview_image_url || p.previewImageUrl;
  const mu = p.media_url || p.mediaUrl;
  const authorAvatar = p.author_avatar_url || p.profile_avatar_url || null;

  // 1) server-derived thumbnail wins (decode HTML entities first),
  //    BUT filter out misleading generic OG placeholders (e.g. Unsplash
  //    fallbacks scraped from Reddit /s/ share links). For platforms where
  //    the thumbnail should plausibly come from the platform itself, drop
  //    anything hosted on a clearly-foreign domain so the typographic
  //    TextCardThumbnail can take over instead of showing a wrong image.
  if (tu) {
    const decoded = decodeHtmlEntities(tu);
    // If the stored thumbnail happens to be the Aelixto poster's own
    // avatar (a known creation-time bug for text-only posts on X /
    // Threads / Reddit), treat the post as having no thumbnail so the
    // typographic TextCardThumbnail can render the actual text instead
    // of a misleading avatar tile.
    const matchesOwnAvatar = !!authorAvatar && sameUrl(decoded, authorAvatar);
    if (matchesOwnAvatar || isMisleadingThumbnail(platform, decoded) || isTextOnlySocialAvatar(platform, decoded)) {
      // Fall through to platform/media derivations or placeholder.
    } else {
      return decoded;
    }
  }

  // 1b) article/unfurl preview images are stored separately from thumbnails.
  // Use them consistently anywhere a grid/share card asks for a post thumb.
  if (piu) {
    const decoded = decodeHtmlEntities(piu);
    const isThreadsAvatar = platform === "threads" && isThreadsProfilePictureUrl(decoded.toLowerCase());
    const matchesOwnAvatar = !!authorAvatar && sameUrl(decoded, authorAvatar);
    if (!matchesOwnAvatar && !isThreadsAvatar && !isMisleadingThumbnail(platform, decoded) && !isTextOnlySocialAvatar(platform, decoded)) {
      return decoded;
    }
  }

  // 2) platform-based derivations used in Feed
  if (platform === "youtube" && mu) {
    const id =
      (mu.match(/(?:v=|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/) || [])[1];
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  // 2b) Reddit: only use media_url when it is the actual image/media asset.
  //     Never return a reddit post page URL as an <img> src, and never fall
  //     back to the Aelixto user's avatar.
  if (platform === "reddit") {
    // Prefer real Reddit media hosts stored on either thumbnail_url or
    // preview_image_url — these are the actual post images/gifs and should
    // beat the platform-branded text card.
    if (tu) {
      const decoded = decodeHtmlEntities(tu);
      if (isRedditMediaHost(decoded) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(decoded)) {
        return decoded;
      }
    }
    if (piu) {
      const decoded = decodeHtmlEntities(piu);
      if (isRedditMediaHost(decoded) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(decoded)) {
        return decoded;
      }
    }
    if (isDirectImageUrl(mu)) return mu!;
    return null;
  }

  // 3) direct image media
  if (mu && /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(mu)) return mu;

  // 4) no reliable image thumbnail — callers can render a branded text tile
  return null;
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
  // For Reddit, reject the platform's branded chrome/logo images that get
  // returned as OG fallbacks for deleted, restricted, or media-less posts.
  // These render as the giant orange "reddit" wordmark in grid tiles.
  if (platform === "reddit") {
    if (lower.includes("redditstatic.com")) return true;
    // share.redd.it /preview/post/<id> serves the generic orange Reddit
    // logo when no real preview exists — never use it as a thumbnail.
    if (lower.includes("share.redd.it/preview/post")) return true;
    // Snoo / brand icon assets served from reddit's CDNs
    if (/\b(reddit[-_ ]?logo|snoo|brand|icon|favicon|default[-_ ]?avatar)\b/.test(lower)) return true;
    // Reddit's generic share fallback image
    if (lower.includes("www.redditstatic.com/")) return true;
    return false;
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
  if (!url) return null;
  
  // Don't proxy local/relative paths or placeholders
  if (url.startsWith("/")) return url;
  
  // Validate URL
  try { 
    new URL(url); 
  } catch { 
    return null; 
  }
  
  // Only allow HTTPS URLs
  if (!url.startsWith("https://")) {
    return null;
  }
  
  // Some CDNs (Quora's qph.*.quoracdn.net, LinkedIn's licdn.com) hotlink-block
  // direct <img> requests from third-party origins, so grid tiles render blank
  // even though the same image works inside the embed (which proxies it).
  // Route those hosts through our img-proxy edge function.
  try {
    const host = new URL(url).hostname;
    if (/(^|\.)quoracdn\.net$|^qph\.|(^|\.)licdn\.com$/i.test(host)) {
      const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      if (base) return `${base}/functions/v1/img-proxy?u=${encodeURIComponent(url)}`;
    }
  } catch {
    // fall through
  }

  // Return ALL URLs directly - no proxying needed
  // Supabase storage URLs are permanent and public
  // YouTube thumbnails are stable
  // Other URLs will work directly or show placeholder on error
  return url;
}
