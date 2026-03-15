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
  } catch {
    return false;
  }
}

const getPostUrl = (post: any): string | undefined => {
  const raw = post?.mediaUrl ?? post?.media_url;
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export function resolveRenderer(post: any): Renderer {
  const url = getPostUrl(post);
  const urlLower = (url ?? '').toLowerCase();
  const platform = String(post?.platform ?? '').toLowerCase();
  const mediaType = String(post?.mediaType ?? post?.media_type ?? '').toLowerCase();

  // 1) Platform/domain-specific renderers that need their own SDK/renderers — BEFORE raw HTML
  if (isRedditUrl(url)) return { kind: 'reddit', url: url! };
  if (url && (platform === 'twitter' || platform === 'x' || urlLower.includes('twitter.com/') || urlLower.includes('x.com/')))
    return { kind: 'twitter', url };
  if (url && (platform === 'pinterest' || urlLower.includes('pinterest.com/') || urlLower.includes('pin.it/')))
    return { kind: 'pinterest', url };
  if (
    url &&
    (platform === 'threads' ||
      platform === 'linkedin' ||
      urlLower.includes('threads.net/') ||
      urlLower.includes('threads.com/') ||
      urlLower.includes('linkedin.com/'))
  ) {
    return { kind: 'universal', url };
  }

  // 2) Raw embed for remaining platforms (Instagram, Facebook, Spotify, TikTok, etc.)
  if (post?.embed_html) {
    return { kind: 'raw', html: post.embed_html };
  }

  if (!url) return { kind: 'none' };

  // 3) Article extractor for blogs/quora/medium/etc (never social/video hosts)
  const blocked = [
    'instagram.com',
    'facebook.com',
    'fb.watch',
    'fb.me',
    'spotify.com',
    'twitter.com',
    'x.com',
    'pinterest.com',
    'pin.it',
    'youtube.com',
    'youtu.be',
    'tiktok.com',
    'reddit.com',
    'redd.it',
    'threads.net',
    'threads.com',
    'linkedin.com',
  ];
  const isBlocked = blocked.some((d) => urlLower.includes(d));
  if (!isBlocked && (mediaType === 'none' || mediaType === '')) return { kind: 'article', url };

  // 4) Universal meta (not reddit/twitter/pinterest)
  const universalAllow = [
    'instagram.com',
    'facebook.com',
    'fb.watch',
    'fb.me',
    'spotify.com',
    'threads.net',
    'threads.com',
    'linkedin.com',
    'tiktok.com',
  ];
  if (universalAllow.some((d) => urlLower.includes(d))) return { kind: 'universal', url };

  // 5) Media fallbacks
  if (mediaType === 'image') return { kind: 'image', url };
  if (mediaType === 'video') return { kind: 'video', url };

  return { kind: 'none' };
}
