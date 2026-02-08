export type Renderer =
  | { kind: 'reddit'; url: string }
  | { kind: 'raw'; html: string }
  | { kind: 'twitter'; url: string }
  | { kind: 'pinterest'; url: string }
  | { kind: 'article'; url: string }
  | { kind: 'universal'; url: string }
  | { kind: 'native'; url: string; platform: string }
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

// Platforms that support native card rendering via Outstand API
const NATIVE_CARD_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'x', 'twitter'];

export function resolveRenderer(post: any): Renderer {
  // 1) raw embed wins
  if (post?.embed_html) return { kind: 'raw', html: post.embed_html };

  const url: string | undefined = post?.mediaUrl;
  if (!url) return { kind: 'none' };

  // 2) reddit wins before everything else
  if (isRedditUrl(url)) return { kind: 'reddit', url };

  // 3) Check for native card support (posts with raw_json_data or platforms that support it)
  const platform = post?.platform?.toLowerCase();
  const hasNativeData = !!post?.raw_json_data;
  
  // If post has native data cached, prefer native rendering
  if (hasNativeData && platform && NATIVE_CARD_PLATFORMS.includes(platform)) {
    return { kind: 'native', url, platform };
  }

  // 4) platform-specific embeds next
  if (post?.platform === 'twitter') return { kind: 'twitter', url };
  if (post?.platform === 'pinterest') return { kind: 'pinterest', url };

  // 5) article extractor for blogs/quora/medium/etc (never reddit)
  const blocked = ['instagram.com','facebook.com','fb.watch','fb.me','spotify.com','twitter.com','x.com','pinterest.com','youtube.com','youtu.be','tiktok.com','reddit.com','redd.it'];
  const isBlocked = blocked.some(d => url.includes(d));
  if (!isBlocked && post?.mediaType === 'none') return { kind: 'article', url };

  // 6) universal meta (not reddit) - fallback for platforms without native support yet
  const universalAllow = ['instagram.com','facebook.com','fb.watch','fb.me','spotify.com'];
  if (universalAllow.some(d => url.includes(d))) return { kind: 'universal', url };

  // 7) media fallbacks
  if (post?.mediaType === 'image') return { kind: 'image', url };
  if (post?.mediaType === 'video') return { kind: 'video', url };

  return { kind: 'none' };
}
