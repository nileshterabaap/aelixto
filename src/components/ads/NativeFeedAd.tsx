import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { AD_MIN_REQUEST_INTERVAL_MS, getNativeFeedAdUnitId } from '@/config/ads';
import { adsReady } from '@/lib/adConsent';
import { GamNative, type NativeAdCreative } from 'aelixto-gam-native';

let lastRequestAt = 0;

async function requestNativeAd(): Promise<NativeAdCreative | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const now = Date.now();
  if (now - lastRequestAt < AD_MIN_REQUEST_INTERVAL_MS) return null;
  lastRequestAt = now;

  const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
  const adUnitId = getNativeFeedAdUnitId(platform);
  if (!adUnitId) return null;

  try {
    const result = await GamNative.loadNativeAd({ adUnitId });
    return result ?? null;
  } catch (e) {
    console.warn('[ads] loadNativeAd failed', e);
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

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const ok = await adsReady();
      if (!ok || !mountedRef.current) return;
      const creative = await requestNativeAd();
      if (!mountedRef.current) return;
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

    const pushFrame = () => {
      const r = el.getBoundingClientRect();
      const payload = {
        adId,
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
      if (!presentedRef.current) {
        presentedRef.current = true;
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
