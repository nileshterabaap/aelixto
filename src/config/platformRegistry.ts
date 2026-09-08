/**
 * Centralised platform & content classification for Aelixto.
 *
 * Every URL posted by a user is classified into one of:
 *   1. A recognised **platform** (Instagram, YouTube, …)
 *   2. **article** — long-form written content (Medium, Substack, auto-detected)
 *   3. **external** — catch-all for generic / unknown websites
 */

export interface PlatformEntry {
  /** DB-stored key, also used in tab queries */
  key: string;
  label: string;
  /** Domains that identify this platform (matched with `url.includes(d)`) */
  domains: string[];
}

export const PLATFORM_REGISTRY: PlatformEntry[] = [
  { key: 'instagram',  label: 'Instagram',  domains: ['instagram.com'] },
  { key: 'threads',    label: 'Threads',    domains: ['threads.net', 'threads.com'] },
  { key: 'facebook',   label: 'Facebook',   domains: ['facebook.com', 'fb.watch', 'fb.me'] },
  { key: 'youtube',    label: 'YouTube',    domains: ['youtube.com', 'youtu.be'] },
  { key: 'twitter',    label: 'X',          domains: ['x.com', 'twitter.com'] },
  { key: 'reddit',     label: 'Reddit',     domains: ['reddit.com', 'redd.it'] },
  { key: 'linkedin',   label: 'LinkedIn',   domains: ['linkedin.com'] },
  { key: 'pinterest',  label: 'Pinterest',  domains: ['pinterest.com', 'pin.it'] },
  { key: 'tiktok',     label: 'TikTok',     domains: ['tiktok.com'] },
  { key: 'spotify',    label: 'Spotify',    domains: ['spotify.com'] },
  { key: 'quora',      label: 'Quora',      domains: ['quora.com'] },
];

/** Known article / blog hosting domains → classified as "article" */
export const ARTICLE_DOMAINS = [
  'medium.com',
  'substack.com',
  'ghost.io',
  'wordpress.com',
  'hashnode.com',
  'dev.to',
  'mirror.xyz',
  'blogger.com',
  'wikipedia.org',
  'wikimedia.org',
  'fandom.com',
  'notion.site',
  'bearblog.dev',
  'tumblr.com',
];

/**
 * Classify a URL into a platform key.
 *
 * @param url      The media/link URL
 * @param ogType   Optional og:type value from the page's metadata
 * @returns platform key string  (e.g. "instagram", "article", "external")
 */
export function classifyUrl(url: string, ogType?: string | null): string {
  if (!url) return 'external';
  const lower = url.toLowerCase();

  // 1. Known platform match
  for (const p of PLATFORM_REGISTRY) {
    if (p.domains.some(d => lower.includes(d))) return p.key;
  }

  // 2. Known article domains
  if (ARTICLE_DOMAINS.some(d => lower.includes(d))) return 'article';

  // 3. OG-type heuristic for unknown domains
  if (ogType) {
    const t = ogType.toLowerCase();
    if (
      t === 'article' ||
      t.includes('blog') ||
      t.includes('newsarticle') ||
      t.includes('reportagenewsarticle')
    ) {
      return 'article';
    }
  }

  // 4. URL path heuristic — detect article-like URLs from news sites
  try {
    const parsed = new URL(lower);
    const path = parsed.pathname;
    // Slug-based article paths: /category/long-hyphenated-title-123.html
    const hasHtmlExt = path.endsWith('.html') || path.endsWith('.htm');
    const hasArticlePath = /\/(article|story|news|post|blog|opinion|editorial)\//i.test(path);
    const longSlug = path.split('/').some(seg => {
      const parts = seg.split('-');
      return parts.length >= 5 && seg.length >= 30;
    });
    if (hasHtmlExt || hasArticlePath || longSlug) {
      return 'article';
    }
  } catch { /* ignore parse errors */ }

  // 5. Fallback
  return 'external';
}

/**
 * Derive the default `media_type` for a URL based on the classified platform.
 */
export function deriveMediaType(url: string, platform: string): string {
  if (['youtube', 'tiktok'].includes(platform)) return 'video';
  if (platform === 'twitter') return 'video';
  if (platform === 'instagram') {
    if (url.includes('/reel/') || url.includes('/reels/')) return 'video';
    return 'image';
  }
  if (platform === 'pinterest') return 'image';
  return 'none';
}
