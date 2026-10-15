import { useMemo, useRef } from 'react';
import { AD_INTERVAL, isAdTestMode } from '@/config/ads';
import { useAdsEligibility, adsEligibilityReason } from '@/hooks/useAdsEligibility';
import { computeAdAfterIndices, getSeenSinceLastAd } from '@/lib/adCadence';

export type FeedItem<T> =
  | { kind: 'post'; slotIndex: number; post: T }
  | { kind: 'ad'; slotIndex: number };

/**
 * Interleaves ad slots by posts SEEN across sessions (see adCadence). The
 * carried count is snapshotted when the list is (re)built — i.e. when its
 * first post changes (refresh / app open) — so ads don't jump while scrolling
 * or when more posts load at the bottom.
 */
export function useFeedWithAds<T extends { id: string }>(posts: T[]): Array<FeedItem<T>> {
  const eligible = useAdsEligibility();
  const snapRef = useRef<{ firstId: string | undefined; carried: number } | null>(null);
  const firstId = posts[0]?.id;
  if (!snapRef.current || snapRef.current.firstId !== firstId) {
    snapRef.current = { firstId, carried: getSeenSinceLastAd() };
  }
  const carried = snapRef.current.carried;

  return useMemo(() => {
    const out: Array<FeedItem<T>> = [];
    const after = eligible ? new Set(computeAdAfterIndices(posts.length, carried, AD_INTERVAL)) : new Set<number>();
    let adCount = 0;
    posts.forEach((post, i) => {
      out.push({ kind: 'post', slotIndex: i, post });
      if (after.has(i)) {
        adCount += 1;
        out.push({ kind: 'ad', slotIndex: adCount });
      }
    });
    console.log('[ads] feed interleave: posts =', posts.length, 'eligible =', eligible,
      'interval =', AD_INTERVAL, 'carriedSeen =', carried, 'adSlotsInserted =', adCount,
      '| reason =', adsEligibilityReason,
      '| testMode =', isAdTestMode());
    return out;
  }, [posts, eligible, carried]);
}
