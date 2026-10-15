/**
 * Ad cadence based on posts actually SEEN, not posts in one list.
 *
 * A persistent counter tracks how many distinct feed posts the user has seen
 * since the last ad was shown, across refreshes and app opens. When a feed
 * list is (re)built, the carried count decides where the first ad goes:
 * after the remaining posts needed to reach the interval, but never above
 * the first post — an ad that is already due goes in the second spot.
 */
const LS_COUNT = 'aelixto_ads_seen_since_ad';
const LS_SEEN_IDS = 'aelixto_ads_seen_ids';
const MAX_IDS = 500;

/** Pure placement: indices of posts after which an ad slot is inserted. */
export function computeAdAfterIndices(postCount: number, carried: number, interval: number): number[] {
  const out: number[] = [];
  if (postCount < 2 || interval < 1) return out;
  const needed = Math.max(1, interval - Math.max(0, carried));
  // Never place an ad before the first post, nor after the last one.
  for (let i = needed - 1; i < postCount - 1; i += interval) out.push(i);
  return out;
}

function readCount(): number {
  try { return Math.max(0, Number(localStorage.getItem(LS_COUNT)) || 0); } catch { return 0; }
}

let seenIds: string[] | null = null;
function ids(): string[] {
  if (!seenIds) {
    try { seenIds = JSON.parse(localStorage.getItem(LS_SEEN_IDS) || '[]'); } catch { seenIds = []; }
    if (!Array.isArray(seenIds)) seenIds = [];
  }
  return seenIds;
}

export function getSeenSinceLastAd(): number {
  return readCount();
}

/** Count a feed post once, ever, toward the next ad. */
export function noteFeedPostSeen(postId: string) {
  const list = ids();
  if (list.includes(postId)) return;
  list.push(postId);
  if (list.length > MAX_IDS) list.splice(0, list.length - MAX_IDS);
  try {
    localStorage.setItem(LS_SEEN_IDS, JSON.stringify(list));
    localStorage.setItem(LS_COUNT, String(readCount() + 1));
  } catch {}
}

/** An ad was actually visible on screen — restart the count. */
export function noteAdShown() {
  try { localStorage.setItem(LS_COUNT, '0'); } catch {}
}

/** Observe a feed post element; counts it once when ≥50% visible. */
export function observeFeedPostForAds(el: HTMLElement, postId: string) {
  if ((el as any).__adSeenObs) return;
  const obs = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        noteFeedPostSeen(postId);
        obs.disconnect();
      }
    },
    { threshold: 0.5 },
  );
  obs.observe(el);
  (el as any).__adSeenObs = obs;
}
