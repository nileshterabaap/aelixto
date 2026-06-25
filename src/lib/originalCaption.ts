const decodeHtmlEntities = (value: string) => {
  if (typeof document === 'undefined') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const cleanFacebookTitleCaption = (value: string) => {
  let text = value.trim();
  // Facebook titles often arrive as: "8.7M views · 332K reactions | caption | Page".
  text = text.replace(/^\s*[\d.,]+\s*[KMB]?\s+views?\s*·\s*[\d.,]+\s*[KMB]?\s+reactions?\s*\|\s*/i, '');
  const parts = text.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, -1).join(' | ').trim();
  return text;
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
  const rawTitle = title?.trim();
  const normalizedUserCaption = decodeHtmlEntities(userCaption?.trim() || '');
  const platformKey = (platform || '').toLowerCase();

  let candidate = rawPreview || '';

  // Existing Facebook/Reddit/Threads posts created before preview_text was wired
  // still have the original source text embedded in title. Use it only as a
  // fallback so future fetched captions remain authoritative.
  if (!candidate && rawTitle && ['facebook', 'reddit', 'threads'].includes(platformKey)) {
    candidate = platformKey === 'facebook' ? cleanFacebookTitleCaption(rawTitle) : rawTitle;
  }

  const decoded = decodeHtmlEntities(candidate).replace(/\s+/g, ' ').trim();
  if (!decoded || decoded === normalizedUserCaption) return '';
  if (/^view (this post )?on /i.test(decoded)) return '';
  return decoded;
};