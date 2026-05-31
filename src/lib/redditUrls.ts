export function isUnresolvedRedditShareUrl(url?: string | null) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      (/(^|\.)reddit\.com$/i.test(parsed.hostname) || parsed.hostname === "redd.it") &&
      /\/s\/[a-z0-9]+\/?$/i.test(parsed.pathname)
    );
  } catch {
    return /reddit\.com\/r\/[^/]+\/s\/[a-z0-9]+\/?$/i.test(url);
  }
}

export function buildRedditEmbedSrc(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (!/(^|\.)reddit\.com$/i.test(u.hostname) && u.hostname !== "redd.it") return null;
    if (!/\/comments\/[a-z0-9_]+/i.test(u.pathname)) return null;
    const path = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
    const params = new URLSearchParams({
      embed: "true",
      ref_source: "embed",
      ref: "share",
      utm_medium: "widgets",
      utm_source: "embedv2",
      utm_term: "23",
      utm_name: "post_embed",
      embed_host_url: typeof window !== "undefined" ? window.location.origin : "",
    });
    return `https://embed.reddit.com${path}?${params.toString()}`;
  } catch {
    return null;
  }
}