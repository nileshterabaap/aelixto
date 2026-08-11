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
  const url: string | undefined = post?.mediaUrl || post?.media_url || undefined;
  const platform = String(post?.platform || '').toLowerCase();
  const mediaType = String(post?.mediaType || post?.media_type || '').toLowerCase();
  const isYouTubeUrl = !!url && (/youtube\.com/i.test(url) || /youtu\.be/i.test(url));

  // YouTube oEmbed always reserves a landscape player. Route every YouTube
  // post through our own iframe renderer so Shorts can use a true 9:16 frame.
  if (url && (platform === 'youtube' || isYouTubeUrl) && (mediaType === 'video' || isYouTubeUrl)) {
    return { kind: 'video', url };
  }

  // 1) Platform-specific renderers that need their own SDKs — BEFORE raw HTML
  if (isRedditUrl(url)) return { kind: 'reddit', url: url! };
  if (url && platform === 'twitter') return { kind: 'twitter', url };
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
