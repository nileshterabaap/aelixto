// Feature flags for embed types - toggle these to enable/disable specific platforms
export const EMBED_FEATURE_FLAGS = {
  instagram: true,
  facebook: true,
  twitter: true,
  pinterest: true,
  youtube: true,
  tiktok: true,
  reddit: true,
  spotify: true,
  quora: true,
  medium: true,
  // Article embeds - Universal system for written content
  articles: true,
  // Quora preview card - isolated feature (default ON)
  quora_preview: true,
} as const;

export type EmbedPlatform = keyof typeof EMBED_FEATURE_FLAGS;

export const isEmbedEnabled = (platform: EmbedPlatform): boolean => {
  return EMBED_FEATURE_FLAGS[platform] ?? false;
};

/**
 * Universal Auto Stop for embeds (Feed + Grid).
 * When false, embeds behave exactly as before (ring A/B only, no recreation).
 */
export const AUTO_STOP_ENABLED = true;
