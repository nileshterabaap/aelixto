/**
 * Measure the rendered height of a 3rd-party embed BEFORE a post goes live.
 *
 * Mounts a hidden iframe pointed at the platform's embed URL, listens for
 * the platform's cross-origin postMessage resize event, and resolves with
 * the first valid height it sees (or null on timeout).
 *
 * Platforms that reliably postMessage: Threads, Facebook.
 * Other platforms resolve null and fall back to the viewer-time persistence.
 */

type PlatformKind =
  | "threads"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "pinterest"
  | null;

const detect = (url: string): PlatformKind => {
  const u = url.toLowerCase();
  if (u.includes("threads.net") || u.includes("threads.com")) return "threads";
  if (
    u.includes("facebook.com") ||
    u.includes("fb.watch") ||
    u.includes("fb.me")
  )
    return "facebook";
  if (u.includes("instagram.com") || u.includes("instagr.am")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("pinterest.com") || u.includes("pin.it")) return "pinterest";
  return null;
};

const buildThreadsSrc = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (!/\/@[^/]+\/post\/[A-Za-z0-9_-]+/.test(u.pathname)) return null;
    const cleanPath = u.pathname.replace(/\/$/, "");
    return `https://www.threads.net${cleanPath}/embed`;
  } catch {
    return null;
  }
};

const buildFacebookSrc = (url: string): string | null => {
  try {
    const lower = url.toLowerCase();
    if (lower.includes("/share/")) return null; // needs server-side expansion first
    const isVideo =
      lower.includes("/reel/") ||
      lower.includes("/videos/") ||
      lower.includes("/watch/") ||
      lower.includes("fb.watch");
    const endpoint = isVideo ? "video.php" : "post.php";
    const encoded = encodeURIComponent(url);
    const query = isVideo
      ? `href=${encoded}&width=500`
      : `href=${encoded}&show_text=true&width=500`;
    return `https://www.facebook.com/plugins/${endpoint}?${query}`;
  } catch {
    return null;
  }
};

const buildInstagramSrc = (url: string): string | null => {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    if (!/\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+/.test(path)) return null;
    return `https://www.instagram.com${path}/embed/`;
  } catch {
    return null;
  }
};

const buildTikTokSrc = (url: string): string | null => {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/@[^/]+\/video\/(\d+)/);
    if (!m) return null;
    return `https://www.tiktok.com/embed/v2/${m[1]}`;
  } catch {
    return null;
  }
};

const buildLinkedInSrc = (url: string): string | null => {
  try {
    const u = new URL(url);
    const feedMatch = u.pathname.match(/\/feed\/update\/(urn:li:\w+:\d+)/);
    if (feedMatch) {
      return `https://www.linkedin.com/embed/feed/update/${feedMatch[1]}?collapsed=1`;
    }
    const postMatch = u.pathname.match(/\/posts\/[^/]+[_-](?:ugcPost|activity)-(\d+)-/);
    if (postMatch) {
      const typeMatch = u.pathname.match(/[_-](ugcPost|activity)-/);
      const type = typeMatch ? typeMatch[1] : "ugcPost";
      return `https://www.linkedin.com/embed/feed/update/urn:li:${type}:${postMatch[1]}?collapsed=1`;
    }
    return null;
  } catch {
    return null;
  }
};

const buildPinterestSrc = (url: string): string | null => {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/pin\/(\d+)/);
    if (!m) return null;
    return `https://assets.pinterest.com/ext/embed.html?id=${m[1]}`;
  } catch {
    return null;
  }
};

const buildSrc = (platform: Exclude<PlatformKind, null>, url: string): string | null => {
  switch (platform) {
    case "threads":   return buildThreadsSrc(url);
    case "facebook":  return buildFacebookSrc(url);
    case "instagram": return buildInstagramSrc(url);
    case "tiktok":    return buildTikTokSrc(url);
    case "linkedin":  return buildLinkedInSrc(url);
    case "pinterest": return buildPinterestSrc(url);
  }
};

const ORIGIN_MATCH: Record<Exclude<PlatformKind, null>, (origin: string) => boolean> = {
  threads:   (o) => o.includes("threads.net") || o.includes("threads.com"),
  facebook:  (o) => o.includes("facebook.com"),
  instagram: (o) => o.includes("instagram.com") || o.includes("cdninstagram.com"),
  tiktok:    (o) => o.includes("tiktok.com"),
  linkedin:  (o) => o.includes("linkedin.com"),
  pinterest: (o) => o.includes("pinterest.com") || o.includes("pinimg.com"),
};

const extractHeight = (data: unknown): number | null => {
  let payload: unknown = data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object") return null;
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object" || seen.has(cur)) continue;
    seen.add(cur);
    const rec = cur as Record<string, unknown>;
    const candidates = [
      rec.height,
      rec.iframeHeight,
      rec.frameHeight,
      (rec.dimensions as any)?.height,
      (rec.size as any)?.height,
    ];
    for (const c of candidates) {
      if (typeof c === "number" && Number.isFinite(c) && c > 80) return c;
    }
    Object.values(rec).forEach((v) => v && typeof v === "object" && queue.push(v));
  }
  return null;
};

export async function measureEmbedHeight(
  url: string,
  timeoutMs = 5000
): Promise<number | null> {
  if (typeof window === "undefined") return null;
  const platform = detect(url);
  if (!platform) return null;

  const src = buildSrc(platform, url);
  if (!src) return null;

  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText =
      "position:fixed;left:-9999px;top:0;width:500px;height:1px;overflow:hidden;pointer-events:none;opacity:0;";
    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.setAttribute("scrolling", "no");
    iframe.style.cssText =
      "border:0;width:500px;height:600px;display:block;background:transparent;";
    container.appendChild(iframe);
    document.body.appendChild(container);

    let resolved = false;
    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      try {
        document.body.removeChild(container);
      } catch {
        /* noop */
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const origin = event.origin || "";
      if (!ORIGIN_MATCH[platform](origin)) return;

      const h = extractHeight(event.data);
      if (!h) return;
      const clamped = Math.min(1400, Math.max(200, Math.round(h)));
      const result = clamped;
      cleanup();
      resolve(result);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    window.addEventListener("message", onMessage);
  });
}