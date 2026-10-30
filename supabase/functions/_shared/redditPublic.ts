// Reddit public-page helpers that work from server (datacenter) addresses.
//
// Reddit blocks its JSON API and normal page requests from cloud servers
// (403 "Blocked"), and the borrowed app token we used for share links is no
// longer accepted (401). Two doors are still open:
//   1. Share links (`/r/<sub>/s/<code>`) still answer link-preview crawlers
//      (the same ones WhatsApp/Discord use) with a redirect to the real post.
//   2. The official embed page (embed.reddit.com) still returns the post's
//      title, author, body text, poster image and type.

const CRAWLER_AGENTS = [
  'Discordbot/2.0; +https://discordapp.com',
  'facebookexternalhit/1.1 (+https://www.facebook.com/externalhit_uatext.php)',
  'WhatsApp/2.23.20.0',
];

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

export function isRedditShareLink(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return /(^|\.)reddit\.com$/i.test(u.hostname) && /^\/(?:r|user)\/[^/]+\/s\/[^/]+\/?$/i.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Builds a clean canonical address `https://www.reddit.com/r/<sub>/comments/<id>/`.
 * The slug is dropped on purpose: Reddit's own redirect double-encodes accented
 * slugs (`%25C3%25A9`), and every Reddit endpoint works without it.
 */
export function cleanRedditPostUrl(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.replace(/&amp;/g, '&'));
    if (!/(^|\.)reddit\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/(r|user|u)\/([^/]+)\/comments\/([a-z0-9_]+)/i);
    if (!m) return null;
    const kind = m[1].toLowerCase() === 'r' ? 'r' : 'user';
    return `https://www.reddit.com/${kind}/${m[2]}/comments/${m[3]}/`;
  } catch {
    return null;
  }
}

/** Expands a Reddit mobile share link to its clean canonical post address. */
export async function resolveRedditShareLink(rawUrl: string): Promise<string | null> {
  if (!isRedditShareLink(rawUrl)) return cleanRedditPostUrl(rawUrl);
  for (const ua of CRAWLER_AGENTS) {
    try {
      const res = await fetch(rawUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': ua, 'Accept': 'text/html,*/*;q=0.8' },
      });
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      const clean = location ? cleanRedditPostUrl(location) : null;
      if (clean) return clean;
    } catch {
      // try the next agent
    }
  }
  return null;
}

export type RedditEmbedDetails = {
  canonicalUrl: string;
  title: string | null;
  author: string | null;
  subreddit: string | null;
  body: string | null;
  thumbnail: string | null;
  type: 'video' | 'image' | 'gallery' | 'text' | 'link' | null;
  deleted: boolean;
  aspectRatio: number | null;
};

const TERMINATORS = new Set(['Read more', 'View on Reddit', 'upvote', 'upvotes', 'Comment', 'View in app']);

/** Pure parser for embed.reddit.com HTML (exported for tests). */
export function parseRedditEmbedHtml(html: string, canonicalUrl: string): RedditEmbedDetails | null {
  if (!html || !/embed-container/.test(html)) return null;
  const clean = html.replace(/<(script|style|svg)[^>]*>[\s\S]*?<\/\1>/gi, '');

  const deleted = /This post has been deleted|This post was removed|removed by the moderators/i.test(clean);

  const titleMatch = clean.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || clean.match(/<shreddit-embed-title[^>]*>([\s\S]*?)<\/shreddit-embed-title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '')).trim() || null : null;

  // Post type + direct media URL from Reddit's tracking context.
  let type: RedditEmbedDetails['type'] = null;
  let mediaUrl: string | null = null;
  const ctx = clean.match(/data-faceplate-tracking-context="([^"]*)"/i)
    || clean.match(/<shreddit-screenview-data data="([^"]*)"/i);
  if (ctx) {
    try {
      const data = JSON.parse(decodeEntities(ctx[1]));
      const t = String(data?.post?.type || '').toLowerCase();
      if (t === 'video' || t === 'image' || t === 'gallery' || t === 'text' || t === 'link') type = t;
      if (typeof data?.post?.url === 'string') mediaUrl = data.post.url;
    } catch { /* ignore */ }
  }

  // Lines of visible text inside the card.
  const start = clean.indexOf('embed-container');
  const region = start >= 0 ? clean.slice(start) : clean;
  const lines = decodeEntities(region.replace(/<[^>]+>/g, '\n'))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let author: string | null = null;
  const postedIdx = lines.indexOf('Posted by');
  if (postedIdx >= 0 && lines[postedIdx + 1]) author = lines[postedIdx + 1];
  let subreddit: string | null = null;
  if (postedIdx > 0) subreddit = (lines[postedIdx - 1] === 'Join' ? lines[postedIdx - 2] : lines[postedIdx - 1]) ?? null;

  let body: string | null = null;
  if (title && !deleted) {
    const tIdx = lines.indexOf(title);
    if (tIdx >= 0) {
      const parts: string[] = [];
      for (let i = tIdx + 1; i < lines.length; i++) {
        if (TERMINATORS.has(lines[i]) || /^Sorry, something went wrong/i.test(lines[i])) break;
        parts.push(lines[i]);
      }
      const joined = parts.join('\n\n').trim();
      if (joined) body = joined.slice(0, 4000);
    }
  }

  // Poster / image.
  let thumbnail: string | null = null;
  const poster = clean.match(/\sposter="(https:\/\/[^"]+)"/i);
  if (poster) thumbnail = decodeEntities(poster[1]);
  if (!thumbnail) {
    const img = clean.match(/<img[^>]*\ssrc="(https:\/\/(?:i|preview|external-preview)\.redd\.it\/[^"]+)"/i);
    if (img) thumbnail = decodeEntities(img[1]);
  }
  if (!thumbnail && mediaUrl && /^https:\/\/i\.redd\.it\//i.test(mediaUrl)) thumbnail = mediaUrl;

  const ar = clean.match(/--aspect-ratio:\s*([0-9.]+)/);
  const aspectRatio = ar ? Number(ar[1]) || null : null;

  return { canonicalUrl, title, author, subreddit, body, thumbnail, type, deleted, aspectRatio };
}

/** Reads a post's public details from Reddit's official embed page. */
export async function fetchRedditEmbedDetails(rawUrl: string): Promise<RedditEmbedDetails | null> {
  const canonical = await resolveRedditShareLink(rawUrl);
  if (!canonical) return null;
  const embedUrl = canonical.replace('https://www.reddit.com/', 'https://embed.reddit.com/') + '?showmedia=true';
  for (const ua of CRAWLER_AGENTS) {
    try {
      const res = await fetch(embedUrl, {
        headers: { 'User-Agent': ua, 'Accept': 'text/html,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
      });
      if (!res.ok) { await res.body?.cancel().catch(() => {}); continue; }
      const parsed = parseRedditEmbedHtml(await res.text(), canonical);
      if (parsed) return parsed;
    } catch {
      // try the next agent
    }
  }
  return null;
}

/** Text Reddit shows to crawlers instead of the real post — never store it. */
export function isGenericRedditText(text: string | null | undefined): boolean {
  if (!text) return true;
  const t = text.trim();
  return (
    t === '' ||
    /^reddit$/i.test(t) ||
    /^reddit\s*·\s*r\//i.test(t) ||
    /^reddit post$/i.test(t) ||
    /^from the .+ community on reddit:?$/i.test(t) ||
    /^explore this post and more from the .+ community/i.test(t) ||
    /^\d[\d,.k]* votes?, \d[\d,.k]* comments?\. .* subscribers in the .+ community/i.test(t)
  );
}

/** Removes Reddit's crawler prefix ("From the X community on Reddit: ") and " : r/sub" suffix. */
export function cleanRedditTitle(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text
    .replace(/^from the .+? community on reddit:\s*/i, '')
    .replace(/\s+:\s+r\/[A-Za-z0-9_]+\s*$/, '')
    .trim();
  return isGenericRedditText(t) ? null : t;
}
