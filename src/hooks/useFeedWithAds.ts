import { useMemo } from 'react';
import { AD_INTERVAL } from '@/config/ads';
import { useAdsEligibility } from '@/hooks/useAdsEligibility';

export type FeedItem<T> =
  | { kind: 'post'; slotIndex: number; post: T }
  | { kind: 'ad'; slotIndex: number };

/**
 * Interleaves an ad slot after every AD_INTERVAL real posts when the current
 * viewer is eligible for ads. When ineligible (web, brand-new install, no
 * consent), returns the untouched post list wrapped as `{ kind: 'post' }`.
 */
export function useFeedWithAds<T extends { id: string }>(posts: T[]): Array<FeedItem<T>> {
  const eligible = useAdsEligibility();
  return useMemo(() => {
    const out: Array<FeedItem<T>> = [];
    let adCount = 0;
    posts.forEach((post, i) => {
      out.push({ kind: 'post', slotIndex: i, post });
      if (eligible && (i + 1) % AD_INTERVAL === 0 && i < posts.length - 1) {
        adCount += 1;
        out.push({ kind: 'ad', slotIndex: adCount });
      }
    });
    return out;
  }, [posts, eligible]);
}
