import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { adsReady } from '@/lib/adConsent';

/**
 * Sticky, module-level reason for the current eligibility verdict. The
 * eligibility effect runs once at cold start, so its logs are usually gone by
 * the time a logcat capture starts. This value is re-printed on every feed
 * interleave so the reason is always visible in a capture.
 */
export let adsEligibilityReason = 'pending (effect not run yet)';
function setReason(r: string) {
  adsEligibilityReason = r;
  console.log('[ads] eligibility reason ->', r);
}

/**
 * Returns true only when EVERY condition is met:
 *  - running natively (Capacitor Android/iOS)
 *  - Google Mobile Ads SDK initialized and consent resolved
 */
export function useAdsEligibility(): boolean {
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Capacitor.isNativePlatform()) {
        setReason('not a native platform');
        return;
      }
      console.log('[ads] eligibility: native platform detected, waiting for SDK…');
      const sdkOk = await adsReady();
      if (!sdkOk || cancelled) {
        setReason(`SDK/consent not ready (adsReady=${sdkOk}, cancelled=${cancelled})`);
        console.log('[ads] eligibility BLOCKED: sdkReady =', sdkOk, 'cancelled =', cancelled);
        return;
      }

      if (!cancelled) {
        setReason('ELIGIBLE (native SDK and consent ready)');
        console.log('[ads] eligibility GRANTED: no install-age wait');
        setEligible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return eligible;
}
