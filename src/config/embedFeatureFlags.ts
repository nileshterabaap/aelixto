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
} as const;

export type EmbedPlatform = keyof typeof EMBED_FEATURE_FLAGS;

export const isEmbedEnabled = (platform: EmbedPlatform): boolean => {
  return EMBED_FEATURE_FLAGS[platform] ?? false;
};
