export type Renderer =
  | { kind: 'reddit'; url: string }
  | { kind: 'raw'; html: string }
  | { kind: 'twitter'; url: string }
  | { kind: 'pinterest'; url: string }
  | { kind: 'article'; url: string }
  | { kind: 'universal'; url: string }
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string }
  | { kind: 'none' };

export function isRedditUrl(u?: string) {
  if (!u) return false;
  try {
    const cleaned = u.trim().split(/\s+/)[0];
    const x = new URL(/^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`);
    return /(^|\.)reddit\.com$/i.test(x.hostname) || /^redd\.it$/i.test(x.hostname);
  } catch { return false; }
}

export function resolveRenderer(post: any): Renderer {
  const url: string | undefined = post?.mediaUrl || post?.media_url || post?.url;
  const platform = String(post?.platform || '').toLowerCase();
  const mediaType = post?.mediaType || post?.media_type;

  // 1) Platform-specific renderers that need their own SDKs — BEFORE raw HTML
  if (url && (platform === 'reddit' || isRedditUrl(url))) return { kind: 'reddit', url };
  if (url && (platform === 'twitter' || platform === 'x')) return { kind: 'twitter', url };
  if (url && platform === 'pinterest') return { kind: 'pinterest', url };
  if (url && (platform === 'threads' || platform === 'linkedin'))
    return { kind: 'universal', url };

  // 2) raw embed for remaining platforms (Instagram, Facebook, Spotify, TikTok, etc.)
  if (post?.embed_html) {
    return { kind: 'raw', html: post.embed_html };
  }

  if (!url) return { kind: 'none' };

  // 4) article extractor for blogs/quora/medium/etc (never reddit)
  const blocked = ['instagram.com','facebook.com','fb.watch','fb.me','spotify.com','twitter.com','x.com','pinterest.com','youtube.com','youtu.be','tiktok.com','reddit.com','redd.it','threads.net','threads.com','linkedin.com'];
  const isBlocked = blocked.some(d => url.includes(d));
  if (!isBlocked && mediaType === 'none') return { kind: 'article', url };

  // 5) universal meta (not reddit) — includes TikTok for client-side embed building
  const universalAllow = ['instagram.com','facebook.com','fb.watch','fb.me','spotify.com','threads.net','threads.com','linkedin.com','tiktok.com'];
  if (universalAllow.some(d => url.includes(d))) return { kind: 'universal', url };

  // 6) media fallbacks
  if (mediaType === 'image') return { kind: 'image', url };
  if (mediaType === 'video') return { kind: 'video', url };

  return { kind: 'none' };
}
