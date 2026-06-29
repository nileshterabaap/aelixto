const decodeHtmlEntities = (value: string) => {
  if (typeof document === 'undefined') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const cleanFacebookTitleCaption = (value: string) => {
  let text = value.trim();
  // Facebook titles often arrive as: "8.7M views · 332K reactions | caption | Page".
  text = text
    .replace(/^\s*[\d.,]+\s*[KMB]?\s+views?\s*(?:·|&#xb7;|&middot;|•)\s*[\d.,]+\s*[KMB]?\s+reactions?\s*\|\s*/i, '')
    .replace(/^\s*[\d.,]+\s*[KMB]?\s+reactions?\s*(?:·|&#xb7;|&middot;|•)\s*[\d.,]+\s*[KMB]?\s+shares?\s*\|\s*/i, '')
    .replace(/^\s*[\d.,]+\s*[KMB]?\s+(?:views?|reactions?|shares?)\s*\|\s*/i, '');
  const parts = text.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, -1).join(' | ').trim();
  return text;
};

const BOOTSTRAP_TAIL_MARKERS = [
  'function envFlush',
  'ServerJSQueue.add',
  'requireLazy',
  'Bootloader',
  'DTSGInitialData',
  'window.Env',
  'ajaxpipe_token',
  'enableBootload',
  'bumpVultureJSHash',
  'AsyncRequest',
  'IntlQtEventFalcoEvent',
];

const stripPageBootstrapDumpTail = (value: string) => {
  let earliest = -1;
  for (const marker of BOOTSTRAP_TAIL_MARKERS) {
    const idx = value.indexOf(marker);
    if (idx >= 0 && (earliest === -1 || idx < earliest)) earliest = idx;
  }
  return earliest >= 0 ? value.slice(0, earliest).trim() : value;
};

const normalizeCaption = (value: string) =>
  stripPageBootstrapDumpTail(decodeHtmlEntities(value))
    // Normalise Windows / Mac line endings.
    .replace(/\r\n?/g, '\n')
    // Treat various unicode line/paragraph separators as plain newlines so
    // the visible paragraph breaks from the source post survive.
    .replace(/[\u2028\u2029]/g, '\n')
    // Collapse horizontal whitespace runs (spaces / tabs) only — keep \n.
    .replace(/[ \t\f\v]+/g, ' ')
    // Trim spaces around each newline.
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    // Cap consecutive blank lines at one (i.e. max double-newline).
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const looksClipped = (value: string) => /(?:\.\.\.|…)\s*$/u.test(value.trim());

export const extractOriginalCaptionFromSourceTitle = ({
  title,
  platform,
}: {
  title?: string | null;
  platform?: string | null;
}) => {
  const rawTitle = title?.trim();
  if (!rawTitle) return '';
  const platformKey = (platform || '').toLowerCase();
  const cleaned = platformKey === 'facebook' ? cleanFacebookTitleCaption(rawTitle) : rawTitle;
  const decoded = normalizeCaption(cleaned);
  if (!decoded || isJunkSourceCaption(decoded)) return '';
  return decoded;
};

const isJunkSourceCaption = (value: string) => {
  const text = stripPageBootstrapDumpTail(decodeHtmlEntities(value)).trim();
  return (
    !text ||
    /^view (this post )?on /i.test(text) ||
    /^posted by u\//i.test(text) ||
    /^log in to facebook$/i.test(text) ||
    /^facebook$/i.test(text) ||
    /^x$/i.test(text) ||
    /^tweet$/i.test(text) ||
    / on Threads$/i.test(text) ||
    isPageBootstrapDump(text)
  );
};

// Facebook (and other platforms) occasionally leak raw page bootstrap / SDK
// JavaScript into og:description or oEmbed title fields. Detect those dumps
// and treat them as junk so they never render as a "source caption".
const isPageBootstrapDump = (value: string) => {
  const text = value.slice(0, 4000);
  const bootstrapMarkers = [...BOOTSTRAP_TAIL_MARKERS, 'ServerJSQueue', 'envFlush', '"__rc"', '"rds":{"m"'];
  let hits = 0;
  for (const marker of bootstrapMarkers) {
    if (text.includes(marker)) {
      hits += 1;
      if (hits >= 1) return true;
    }
  }
  // Long strings that are mostly braces / quotes / brackets are code, not prose.
  if (stripPageBootstrapDumpTail(value).trim() !== value.trim()) return false;
  if (text.length > 120) {
    const codey = (text.match(/[{}\[\]"`]/g) || []).length;
    if (codey / text.length > 0.18) return true;
  }
  return false;
};

export const getOriginalPostCaption = ({
  previewText,
  title,
  userCaption,
  platform,
}: {
  previewText?: string | null;
  title?: string | null;
  userCaption?: string | null;
  platform?: string | null;
}) => {
  const rawPreview = previewText?.trim();
  const normalizedUserCaption = normalizeCaption(userCaption?.trim() || '');
  const platformKey = (platform || '').toLowerCase();

  let candidate = rawPreview && !isJunkSourceCaption(rawPreview) ? rawPreview : '';
  const titleCandidate = ['facebook', 'reddit', 'threads', 'twitter', 'x', 'tiktok', 'linkedin'].includes(platformKey)
    ? extractOriginalCaptionFromSourceTitle({ title, platform: platformKey })
    : '';

  // Facebook often gives a short OG description (~200 chars) but the oEmbed
  // title contains the complete original caption. If the preview text is
  // clipped, prefer the longer title-derived source caption.
  if ((platformKey === 'facebook' || platformKey === 'linkedin') && titleCandidate) {
    const normalizedPreview = candidate ? normalizeCaption(candidate) : '';
    if (!normalizedPreview || looksClipped(normalizedPreview) || titleCandidate.length > normalizedPreview.length + 80) {
      candidate = titleCandidate;
    }
  }

  // Existing Facebook/Reddit/Threads posts created before preview_text was wired
  // still have the original source text embedded in title. Use it only as a
  // fallback so future fetched captions remain authoritative.
  if (!candidate && titleCandidate) {
    candidate = titleCandidate;
  }

  const decoded = normalizeCaption(candidate);
  if (!decoded || decoded === normalizedUserCaption) return '';
  if (isJunkSourceCaption(decoded)) return '';
  return decoded;
};