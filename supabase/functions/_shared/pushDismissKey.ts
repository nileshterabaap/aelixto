/**
 * Deterministic "dismiss key" shared by the push sender and the app.
 *
 * The sender stamps every native push with this key (Android: FCM
 * notification `tag`; iOS: custom APNs payload field `dismissKey`). When the
 * user opens the matching post or chat, the app asks the native layer to
 * remove every delivered notification carrying that key — so the shade clears
 * the way Instagram/WhatsApp clear theirs.
 *
 * Keys are derived only from the push's in-app URL, so both sides agree
 * without a round trip. Returns null for notifications that should not be
 * auto-dismissed (likes, follows, comments go to /notifications).
 */
export function pushDismissKey(url: string | null | undefined): string | null {
  if (!url) return null;
  let m = url.match(/^\/post\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
  if (m) return `post-${m[1].toLowerCase()}`;
  m = url.match(/^\/messages\?(?:[^#]*&)?c=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (m) return `chat-${m[1].toLowerCase()}`;
  return null;
}
