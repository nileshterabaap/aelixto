import { CapacitorHttp } from "@capacitor/core";

/**
 * iPhone app only: Reddit refuses to show its player inside the app
 * (capacitor:// pages never match its "frame-ancestors *" rule, and WebKit
 * checks every parent frame, so a relay page cannot help). Instead the phone
 * itself reads the post's public data — native requests carry no page origin
 * and come from the user's own connection, which Reddit accepts — and the app
 * draws the post as a Reddit-style card.
 */

export type RedditMedia =
  | { type: "video"; hlsUrl: string; poster: string | null; width: number | null; height: number | null }
  | { type: "images"; images: { url: string; width: number | null; height: number | null }[] }
  | { type: "none" };

export interface RedditPostData {
  subreddit: string;
  subredditIcon: string | null;
  author: string;
  createdUtc: number | null;
  title: string;
  selftext: string;
  score: number | null;
  numComments: number | null;
  permalink: string;
  externalUrl: string | null;
  externalDomain: string | null;
  nsfw: boolean;
  media: RedditMedia;
}

const decode = (s: unknown): string =>
  typeof s === "string"
    ? s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    : "";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const isHttp = (u: string) => /^https?:\/\//i.test(u);

function pickMedia(post: any): RedditMedia {
  const source = Array.isArray(post?.crosspost_parent_list) && post.crosspost_parent_list[0]
    ? { ...post.crosspost_parent_list[0], ...post, media: post.media || post.crosspost_parent_list[0].media, secure_media: post.secure_media || post.crosspost_parent_list[0].secure_media, media_metadata: post.media_metadata || post.crosspost_parent_list[0].media_metadata, gallery_data: post.gallery_data || post.crosspost_parent_list[0].gallery_data, preview: post.preview || post.crosspost_parent_list[0].preview, is_video: post.is_video || post.crosspost_parent_list[0].is_video }
    : post;

  const previewImage = source?.preview?.images?.[0]?.source;
  const poster = previewImage?.url ? decode(previewImage.url) : null;

  const video = source?.secure_media?.reddit_video || source?.media?.reddit_video || source?.preview?.reddit_video_preview;
  if (video?.hls_url) {
    return {
      type: "video",
      hlsUrl: decode(video.hls_url),
      poster,
      width: num(video.width),
      height: num(video.height),
    };
  }

  if (source?.is_gallery && source?.media_metadata) {
    const order: string[] = Array.isArray(source?.gallery_data?.items)
      ? source.gallery_data.items.map((i: any) => i?.media_id).filter(Boolean)
      : Object.keys(source.media_metadata);
    const images = order
      .map((id) => source.media_metadata[id])
      .filter((m: any) => m && m.status !== "failed" && m.s)
      .map((m: any) => ({ url: decode(m.s.u || m.s.gif || ""), width: num(m.s.x), height: num(m.s.y) }))
      .filter((m) => isHttp(m.url));
    if (images.length) return { type: "images", images };
  }

  const directUrl = decode(source?.url_overridden_by_dest || source?.url || "");
  if (/^https?:\/\/i\.redd\.it\//i.test(directUrl) || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(directUrl)) {
    return {
      type: "images",
      images: [{ url: directUrl, width: num(previewImage?.width), height: num(previewImage?.height) }],
    };
  }

  if (poster && isHttp(poster)) {
    return { type: "images", images: [{ url: poster, width: num(previewImage?.width), height: num(previewImage?.height) }] };
  }

  return { type: "none" };
}

/** Turns Reddit's public post JSON (an array of listings) into card data. */
export function parseRedditPostJson(json: unknown): RedditPostData | null {
  const listing = Array.isArray(json) ? json[0] : json;
  const post = (listing as any)?.data?.children?.[0]?.data;
  if (!post || typeof post !== "object") return null;

  const permalink = typeof post.permalink === "string" ? `https://www.reddit.com${post.permalink}` : "";
  const outbound = decode(post.url_overridden_by_dest || post.url || "");
  let externalUrl: string | null = null;
  let externalDomain: string | null = null;
  if (!post.is_self && isHttp(outbound)) {
    try {
      const host = new URL(outbound).hostname.replace(/^www\./, "");
      if (!/(^|\.)(reddit\.com|redd\.it)$/i.test(host)) {
        externalUrl = outbound;
        externalDomain = host;
      }
    } catch { /* ignore */ }
  }

  return {
    subreddit: String(post.subreddit || ""),
    subredditIcon: null,
    author: String(post.author || ""),
    createdUtc: num(post.created_utc),
    title: decode(post.title),
    selftext: decode(post.selftext),
    score: num(post.score),
    numComments: num(post.num_comments),
    permalink,
    externalUrl,
    externalDomain,
    nsfw: !!post.over_18,
    media: pickMedia(post),
  };
}

/** Builds the JSON address for a canonical `/comments/<id>` Reddit address. */
export function toRedditJsonUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (!/(^|\.)reddit\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/comments\/([a-z0-9_]+)/i);
    if (!m) return null;
    return `https://www.reddit.com/comments/${m[1]}/.json?raw_json=1&limit=1`;
  } catch {
    return null;
  }
}

const HEADERS = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" };
const CACHE_KEY = "aelixto.redditCard.v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const memory = new Map<string, RedditPostData>();
const inflight = new Map<string, Promise<RedditPostData | null>>();

const readStore = (): Record<string, { t: number; d: RedditPostData }> => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
};

const writeStore = (url: string, d: RedditPostData) => {
  try {
    const store = readStore();
    const now = Date.now();
    for (const k of Object.keys(store)) if (now - store[k].t > CACHE_TTL_MS) delete store[k];
    store[url] = { t: now, d };
    const keys = Object.keys(store);
    if (keys.length > 150) keys.sort((a, b) => store[a].t - store[b].t).slice(0, keys.length - 150).forEach((k) => delete store[k]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch { /* storage full or unavailable */ }
};

export function getCachedRedditPost(url: string): RedditPostData | null {
  const hit = memory.get(url);
  if (hit) return hit;
  const stored = readStore()[url];
  if (stored && Date.now() - stored.t < CACHE_TTL_MS) {
    memory.set(url, stored.d);
    return stored.d;
  }
  return null;
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

async function getJson(url: string): Promise<{ data: any; finalUrl: string } | null> {
  const res = await withTimeout(CapacitorHttp.get({ url, headers: HEADERS, responseType: "json" }), 8000);
  if (res.status < 200 || res.status >= 300) return null;
  let data = res.data;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  return { data, finalUrl: res.url || url };
}

async function resolveCanonical(url: string): Promise<string | null> {
  if (toRedditJsonUrl(url)) return url;
  // Share links (/s/…, redd.it) redirect to the canonical post address.
  const res = await withTimeout(CapacitorHttp.get({ url, headers: { ...HEADERS, Accept: "text/html" }, responseType: "text" }), 8000);
  const finalUrl = res.url || "";
  if (toRedditJsonUrl(finalUrl)) return finalUrl;
  const html = typeof res.data === "string" ? res.data : "";
  const m = html.match(/https:\/\/www\.reddit\.com\/r\/[^"'\s<>]+\/comments\/[a-z0-9_]+/i);
  return m ? m[0] : null;
}

async function fetchSubredditIcon(subreddit: string): Promise<string | null> {
  if (!subreddit) return null;
  try {
    const res = await getJson(`https://www.reddit.com/r/${encodeURIComponent(subreddit)}/about.json?raw_json=1`);
    const d = res?.data?.data;
    const icon = decode(d?.community_icon || d?.icon_img || "");
    return isHttp(icon) ? icon : null;
  } catch {
    return null;
  }
}

export function fetchRedditPost(url: string): Promise<RedditPostData | null> {
  const cached = getCachedRedditPost(url);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(url);
  if (existing) return existing;

  const job = (async () => {
    try {
      const canonical = await resolveCanonical(url);
      const jsonUrl = canonical ? toRedditJsonUrl(canonical) : null;
      if (!jsonUrl) return null;
      const res = await getJson(jsonUrl);
      const parsed = res ? parseRedditPostJson(res.data) : null;
      if (!parsed) return null;
      parsed.subredditIcon = await fetchSubredditIcon(parsed.subreddit);
      memory.set(url, parsed);
      writeStore(url, parsed);
      return parsed;
    } catch {
      return null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, job);
  return job;
}
