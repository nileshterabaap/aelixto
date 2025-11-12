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

  // 1) server-derived thumbnail wins
  if (tu) return tu;

  // 2) platform-based derivations used in Feed
  if (platform === "youtube" && mu) {
    const id =
      (mu.match(/(?:v=|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/) || [])[1];
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  // 3) direct image media
  if (mu && /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(mu)) return mu;

  // 4) safe placeholder
  return "/images/placeholder-thumb.png";
}

/** Optional proxy helper; if /api/img-proxy exists use it, else return original. */
export function maybeProxy(url?: string | null, w = 480) {
  if (!url) return "/images/placeholder-thumb.png";
  try { new URL(url); } catch { return "/images/placeholder-thumb.png"; }
  // If an img proxy route exists in the app, use it. If not, just return the URL.
  const hasProxy = true; // keep true only if /api/img-proxy is present; otherwise set false
  return hasProxy ? `/api/img-proxy?u=${encodeURIComponent(url)}&w=${w}` : url;
}
