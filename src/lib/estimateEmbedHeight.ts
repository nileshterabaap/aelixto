/**
 * Estimate the rendered height of a 3rd-party embed at CREATE TIME using
 * only the metadata we've already fetched (caption, title, thumbnail, platform).
 *
 * Purpose: when `measureEmbedHeight` returns null (most platforms don't
 * postMessage their height — Instagram, TikTok, LinkedIn, Pinterest, etc.),
 * we still want the FIRST viewer to open the card at roughly its real size
 * instead of a generic 380px stub that's either too tall or too short.
 *
 * Returns a clamped pixel height, never null — this is the floor for the
 * viewer-time persistence to refine.
 */

const CARD_WIDTH = 360; // typical mobile card width

type Platform =
  | "instagram"
  | "facebook"
  | "threads"
  | "tiktok"
  | "linkedin"
  | "twitter"
  | "pinterest"
  | "spotify"
  | "reddit"
  | "youtube"
  | "unknown";

interface EstimateInput {
  platform: Platform | string | null | undefined;
  url: string;
  caption?: string | null;
  title?: string | null;
  thumbnailUrl?: string | null;
}

// Platform chrome = header (avatar + handle) + footer (like/comment row + branding).
// These are empirical from screenshots of each platform's official embed.
const CHROME: Record<string, { header: number; footer: number; minMedia: number; maxMedia: number }> = {
  instagram: { header: 56, footer: 96, minMedia: 360, maxMedia: 640 },
  facebook:  { header: 56, footer: 64, minMedia: 220, maxMedia: 720 },
  threads:   { header: 48, footer: 56, minMedia: 0,   maxMedia: 520 },
  tiktok:    { header: 0,  footer: 0,  minMedia: 700, maxMedia: 740 },
  linkedin:  { header: 60, footer: 64, minMedia: 220, maxMedia: 560 },
  twitter:   { header: 60, footer: 56, minMedia: 0,   maxMedia: 480 },
  pinterest: { header: 40, footer: 56, minMedia: 320, maxMedia: 720 },
  spotify:   { header: 0,  footer: 0,  minMedia: 152, maxMedia: 352 },
  reddit:    { header: 56, footer: 64, minMedia: 0,   maxMedia: 540 },
  unknown:   { header: 48, footer: 56, minMedia: 0,   maxMedia: 480 },
};

const estimateTextRows = (text: string, charsPerRow: number): number => {
  if (!text) return 0;
  const lines = text.split(/\r?\n/);
  let rows = 0;
  for (const line of lines) {
    rows += Math.max(1, Math.ceil(line.length / charsPerRow));
  }
  return rows;
};

const detectMediaShape = (url: string, platform: string): "square" | "portrait" | "landscape" | "unknown" => {
  const u = url.toLowerCase();
  if (platform === "instagram" && (u.includes("/reel/") || u.includes("/reels/"))) return "portrait";
  if (platform === "instagram") return "square";
  if (platform === "tiktok") return "portrait";
  if (platform === "facebook" && (u.includes("/reel/") || u.includes("fb.watch"))) return "portrait";
  if (platform === "pinterest") return "portrait";
  if (platform === "youtube" && u.includes("/shorts/")) return "portrait";
  return "landscape";
};

export function estimateEmbedHeight(input: EstimateInput): number {
  const platformKey = String(input.platform || "unknown").toLowerCase();
  const chrome = CHROME[platformKey] || CHROME.unknown;

  // Caption height: ~36 chars per row on a 360px card, ~20px line height.
  // We bound the visible caption — most platforms truncate around 4 lines.
  const captionText = (input.caption || "").trim();
  const titleText = (input.title || "").trim();
  const captionRows = Math.min(4, estimateTextRows(captionText, 36));
  const titleRows = Math.min(2, estimateTextRows(titleText, 32));
  const textBlockHeight = captionRows * 20 + titleRows * 22 + (captionText || titleText ? 12 : 0);

  // Media height: thumbnail present → assume the platform shows it at the
  // shape we'd expect for this URL pattern. No thumbnail → text-only post.
  let mediaHeight = 0;
  if (input.thumbnailUrl) {
    const shape = detectMediaShape(input.url, platformKey);
    switch (shape) {
      case "square":    mediaHeight = CARD_WIDTH;            break; // 1:1
      case "portrait":  mediaHeight = Math.round(CARD_WIDTH * 1.25); break; // 4:5
      case "landscape": mediaHeight = Math.round(CARD_WIDTH * 0.56); break; // 16:9
      default:          mediaHeight = Math.round(CARD_WIDTH * 0.75);
    }
    mediaHeight = Math.max(chrome.minMedia, Math.min(chrome.maxMedia, mediaHeight));
  } else if (chrome.minMedia > 0) {
    // Platforms that always include some visual (Spotify player, TikTok) — use the floor.
    mediaHeight = chrome.minMedia;
  }

  const total = chrome.header + mediaHeight + textBlockHeight + chrome.footer;

  // Platform-specific clamps so we never produce something absurd.
  const min = 200;
  const max = platformKey === "tiktok" ? 760 : 900;
  return Math.max(min, Math.min(max, Math.round(total)));
}