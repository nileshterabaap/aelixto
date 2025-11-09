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
    const x = new URL(u);
    return /(^|\.)reddit\.com$/.test(x.hostname) || x.hostname === 'redd.it';
  } catch { return false; }
}

export function resolveRenderer(post: any): Renderer {
  // 1) raw embed wins
  if (post?.embed_html) return { kind: 'raw', html: post.embed_html };

  const url: string | undefined = post?.mediaUrl;
  if (!url) return { kind: 'none' };

  // 2) reddit wins before everything else
  if (isRedditUrl(url)) return { kind: 'reddit', url };

  // 3) platform-specific embeds next
  if (post?.platform === 'twitter') return { kind: 'twitter', url };
  if (post?.platform === 'pinterest') return { kind: 'pinterest', url };

  // 4) article extractor for blogs/quora/medium/etc (never reddit)
  const blocked = ['instagram.com','facebook.com','fb.watch','fb.me','spotify.com','twitter.com','x.com','pinterest.com','youtube.com','youtu.be','tiktok.com','reddit.com','redd.it'];
  const isBlocked = blocked.some(d => url.includes(d));
  if (!isBlocked && post?.mediaType === 'none') return { kind: 'article', url };

  // 5) universal meta (not reddit) - removed facebook as it requires auth
  const universalAllow = ['instagram.com','spotify.com'];
  if (universalAllow.some(d => url.includes(d))) return { kind: 'universal', url };

  // 6) media fallbacks
  if (post?.mediaType === 'image') return { kind: 'image', url };
  if (post?.mediaType === 'video') return { kind: 'video', url };

  return { kind: 'none' };
}
