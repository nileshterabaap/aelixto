import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { AD_MIN_REQUEST_INTERVAL_MS, getNativeFeedAdUnitId, isAdTestMode, isInstallAgeBypassed } from '@/config/ads';
import { adsReady } from '@/lib/adConsent';
import { GamNative, type NativeAdCreative } from 'aelixto-gam-native';

let lastRequestAt = 0;
let slotSeq = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requestNativeAd(tag: string): Promise<NativeAdCreative | null> {
  if (!Capacitor.isNativePlatform()) {
    console.log(`[ads]${tag} step 3 request SKIPPED: not a native platform`);
    return null;
  }

  // Global rate limit. Previously a throttled slot returned null forever and
  // rendered nothing; now it waits out the window so later slots still fill.
  const waitMs = AD_MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (waitMs > 0) {
    console.log(`[ads]${tag} step 3 throttled — waiting ${waitMs}ms (min interval ${AD_MIN_REQUEST_INTERVAL_MS}ms)`);
    await sleep(waitMs);
  }
  lastRequestAt = Date.now();

  const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
  const testMode = isAdTestMode();
  const adUnitId = getNativeFeedAdUnitId(platform);
  console.log(`[ads]${tag} step 2 adUnitId =`, adUnitId,
    '| kind =', testMode ? 'TEST (Google sample unit)' : 'LIVE (Ad Manager unit)',
    '| platform =', platform,
    '| testMode =', testMode, '| installAgeBypass =', isInstallAgeBypassed());
  if (!adUnitId) {
    console.log(`[ads]${tag} step 3 request ABORTED: empty adUnitId`);
    return null;
  }

  const t0 = Date.now();
  console.log(`[ads]${tag} step 3 request SENT to GamNative.loadNativeAd`);
  try {
    const result = await GamNative.loadNativeAd({ adUnitId });
    if (result) {
      console.log(`[ads]${tag} step 4 LOAD SUCCESS in ${Date.now() - t0}ms:`, JSON.stringify(result));
    } else {
      console.log(`[ads]${tag} step 4 LOAD RETURNED NULL (no-fill) in ${Date.now() - t0}ms`);
    }
    return result ?? null;
  } catch (e: any) {
    console.warn(`[ads]${tag} step 5 LOAD FAILED in ${Date.now() - t0}ms`,
      '| code =', e?.code ?? e?.errorCode ?? 'n/a',
      '| message =', e?.message ?? String(e),
      '| raw =', (() => { try { return JSON.stringify(e); } catch { return String(e); } })());
    return null;
  }
}

/**
 * In-feed native ad card. Visually matches HydratedFeedPost rhythm (header,
 * edge-to-edge media, caption) with a mandatory "Ad" chip + advertiser
 * attribution per Google's native-ad policy.
 *
 * Renders nothing (occupies zero space) when:
 *  - not on native
 *  - consent/SDK not ready
 *  - no-fill from AdX
 */
export function NativeFeedAd() {
  const [ad, setAd] = useState<NativeAdCreative | null>(null);
  const [ready, setReady] = useState(false);
  const mountedRef = useRef(true);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const presentedRef = useRef(false);
  const tagRef = useRef(`[slot#${++slotSeq}]`);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const tag = tagRef.current;
      console.log(`[ads]${tag} step 1 slot mounted — awaiting consent/SDK (adsReady)`);
      const ok = await adsReady();
      if (!ok || !mountedRef.current) {
        console.log(`[ads]${tag} step 1 BLOCKED: adsReady =`, ok, '| stillMounted =', mountedRef.current);
        return;
      }
      console.log(`[ads]${tag} step 1 OK: consent resolved + SDK initialized`);
      const creative = await requestNativeAd(tag);
      if (!mountedRef.current) return;
      console.log(`[ads]${tag} step 6 render decision:`, creative ? 'RENDER overlay' : 'RENDER NOTHING (no creative)');
      setAd(creative);
      setReady(true);
    })();
    return () => {
      mountedRef.current = false;
      if (ad?.adId) {
        void GamNative.destroyAd({ adId: ad.adId }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mount + reposition the native NativeAdView overlay so Google's SDK
  // auto-tracks impressions and billable clicks.
  useEffect(() => {
    if (!ad?.adId || !slotRef.current) return;
    const adId = ad.adId;
    const el = slotRef.current;

function measureClip() {
  // Fixed bottom nav height (incl. safe-area) — the overlay must never paint
  // over it. The floating "create post" FAB overhangs the nav's top edge, so
  // the clip must start at the highest of the two. Falls back to 0 when the
  // nav is not mounted on this route.
  let clipBottom = 0;
  const nav = document.querySelector('nav.fixed.bottom-0') as HTMLElement | null;
  if (nav) {
    let top = nav.getBoundingClientRect().top;
    const fab = nav.querySelector('[aria-label="Create post"]') as HTMLElement | null;
    if (fab) top = Math.min(top, fab.getBoundingClientRect().top);
    clipBottom = Math.max(0, Math.round(window.innerHeight - top));
  }
  return { clipTop: 0, clipBottom };
}

    const pushFrame = () => {
      const r = el.getBoundingClientRect();
      const clip = measureClip();
      const payload = {
        adId,
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
        ...clip,
      };
      if (!presentedRef.current) {
        presentedRef.current = true;
        console.log('[ads] presentNativeAd overlay for adId =', adId, 'frame =', JSON.stringify(payload));
        void GamNative.presentNativeAd(payload).catch(() => {});
      } else {
        void GamNative.updateNativeAdFrame(payload).catch(() => {});
      }
    };
    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(pushFrame);
    };

    pushFrame();
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ad?.adId]);

  if (!ready || !ad) return null;

  // Reserved-height placeholder. The real ad UI lives in the native overlay
  // (NativeAdView on Android, GADNativeAdView on iOS) positioned exactly on
  // top of this box. Height matches the feed post rhythm.
  return (
    <div
      ref={slotRef}
      aria-hidden
      data-native-ad="1"
      style={{ height: 340, width: '100%' }}
    />
  );
}

export default NativeFeedAd;
