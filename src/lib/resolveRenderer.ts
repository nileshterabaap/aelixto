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
  const url: string | undefined = post?.mediaUrl;

  // 1) Platforms that have dedicated renderers or work better without raw HTML
  //    must be routed BEFORE the generic raw path.
  if (post?.platform === 'twitter' && url) return { kind: 'twitter', url };
  if (post?.platform === 'pinterest' && url) return { kind: 'pinterest', url };
  if (url && isRedditUrl(url)) return { kind: 'reddit', url };

  // Threads & LinkedIn render best via UniversalMetaEmbed (direct iframe),
  // not through RawEmbedRenderer SDK processing.
  const universalFirst = ['threads', 'linkedin'];
  if (universalFirst.includes(post?.platform) && url) {
    return { kind: 'universal', url };
  }

  // 2) raw embed wins for remaining platforms (Instagram, Facebook, Spotify,
  //    YouTube, TikTok) — pre-stored HTML renders instantly.
  if (post?.embed_html) {
    return { kind: 'raw', html: post.embed_html };
  }

  if (!url) return { kind: 'none' };

  // 3) article extractor for blogs/quora/medium/etc (never reddit)
  const blocked = ['instagram.com','facebook.com','fb.watch','fb.me','spotify.com','twitter.com','x.com','pinterest.com','youtube.com','youtu.be','tiktok.com','reddit.com','redd.it','threads.net','threads.com','linkedin.com'];
  const isBlocked = blocked.some(d => url.includes(d));
  if (!isBlocked && post?.mediaType === 'none') return { kind: 'article', url };

  // 4) universal meta — includes TikTok for client-side embed building
  const universalAllow = ['instagram.com','facebook.com','fb.watch','fb.me','spotify.com','tiktok.com'];
  if (universalAllow.some(d => url.includes(d))) return { kind: 'universal', url };

  // 5) media fallbacks
  if (post?.mediaType === 'image') return { kind: 'image', url };
  if (post?.mediaType === 'video') return { kind: 'video', url };

  return { kind: 'none' };
}
