/**
 * Embed metadata helpers for static-first rendering.
 * Computes aspect ratio and renderer kind deterministically from post data.
 * Zero network cost — pure string matching.
 */

export interface EmbedMetadata {
  rendererKind: string;
  aspectRatio: string;
  authorName?: string;
}

/** Derive embed display metadata from post properties (platform, mediaType, url). */
export function computeEmbedMetadata(
  platform?: string | null,
  mediaType?: string | null,
  url?: string | null,
  embedHtml?: string | null
): EmbedMetadata {
  // Defaults
  let aspectRatio = '16/9';
  let rendererKind = 'none';

  // If embed_html exists, it's a raw embed
  if (embedHtml) {
    rendererKind = 'raw';
    // Instagram/Facebook raw embeds default to 4/5
    if (platform === 'instagram' || platform === 'facebook') {
      aspectRatio = '4/5';
    }
    return { rendererKind, aspectRatio };
  }

  if (!url && !platform) return { rendererKind: 'none', aspectRatio };

  const u = url || '';

  // Platform-specific aspect ratios and renderer kinds
  switch (platform) {
    case 'youtube':
      aspectRatio = u.includes('/shorts/') ? '9/16' : '16/9';
      rendererKind = 'video';
      break;
    case 'tiktok':
      aspectRatio = '9/16';
      rendererKind = 'universal';
      break;
    case 'instagram':
      aspectRatio = u.includes('/reel') ? '9/16' : '4/5';
      rendererKind = 'universal';
      break;
    case 'twitter':
    case 'x':
      aspectRatio = '3/4';
      rendererKind = 'twitter';
      break;
    case 'reddit':
      aspectRatio = '16/9';
      rendererKind = 'reddit';
      break;
    case 'pinterest':
      aspectRatio = '2/3';
      rendererKind = 'pinterest';
      break;
    case 'facebook':
      aspectRatio = '4/5';
      rendererKind = 'universal';
      break;
    case 'spotify':
      aspectRatio = '1/1';
      rendererKind = 'universal';
      break;
    case 'linkedin':
      aspectRatio = '4/5';
      rendererKind = 'universal';
      break;
    case 'threads':
      aspectRatio = '4/5';
      rendererKind = 'universal';
      break;
    case 'medium':
    case 'quora':
    case 'blog':
      aspectRatio = '16/9';
      rendererKind = 'article';
      break;
    default:
      // Unknown platform — check mediaType
      if (mediaType === 'none' || !mediaType) {
        rendererKind = 'article';
        aspectRatio = '16/9';
      }
      break;
  }

  // Override renderer kind for explicit media types (but keep platform aspect ratio)
  if (mediaType === 'image' && !['universal', 'raw'].includes(rendererKind)) {
    rendererKind = 'image';
  }
  if (mediaType === 'video' && platform !== 'youtube' && !['universal', 'raw'].includes(rendererKind)) {
    rendererKind = 'video';
  }

  // URL-based detection for posts without platform
  if (rendererKind === 'none' && u) {
    if (u.includes('reddit.com') || u.includes('redd.it')) {
      rendererKind = 'reddit';
      aspectRatio = '16/9';
    } else if (u.includes('instagram.com')) {
      rendererKind = 'universal';
      aspectRatio = '4/5';
    } else if (u.includes('twitter.com') || u.includes('x.com')) {
      rendererKind = 'twitter';
      aspectRatio = '3/4';
    } else if (u.includes('pinterest.com') || u.includes('pin.it')) {
      rendererKind = 'pinterest';
      aspectRatio = '2/3';
    } else if (u.includes('spotify.com')) {
      rendererKind = 'universal';
      aspectRatio = '1/1';
    } else if (u.includes('facebook.com') || u.includes('fb.watch')) {
      rendererKind = 'universal';
      aspectRatio = '4/5';
    } else if (u.includes('tiktok.com')) {
      rendererKind = 'universal';
      aspectRatio = '9/16';
    }
  }

  return { rendererKind, aspectRatio };
}

/** Read stored metadata from raw_json_data (if available). */
export function getStoredMetadata(post: any): EmbedMetadata | null {
  const raw = post?.raw_json_data || post?.rawJsonData;
  if (!raw) return null;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (data?.rendererKind) return data as EmbedMetadata;
  return null;
}
