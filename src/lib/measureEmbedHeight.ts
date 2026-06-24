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

type PlatformKind = "threads" | "facebook" | null;

const detect = (url: string): PlatformKind => {
  const u = url.toLowerCase();
  if (u.includes("threads.net") || u.includes("threads.com")) return "threads";
  if (
    u.includes("facebook.com") ||
    u.includes("fb.watch") ||
    u.includes("fb.me")
  )
    return "facebook";
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

  const src =
    platform === "threads" ? buildThreadsSrc(url) : buildFacebookSrc(url);
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
      const validOrigin =
        (platform === "threads" &&
          (origin.includes("threads.net") || origin.includes("threads.com"))) ||
        (platform === "facebook" && origin.includes("facebook.com"));
      if (!validOrigin) return;

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