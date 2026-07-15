import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Card } from '@/components/ui/card';
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
  const impressionFiredRef = useRef(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

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

  // Fire the Google impression the first time the card actually appears
  // on-screen (>=50% visible), which is Google's required visibility bar.
  useEffect(() => {
    if (!ad?.adId || impressionFiredRef.current || !cardRef.current) return;
    const node = cardRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.5 && !impressionFiredRef.current) {
            impressionFiredRef.current = true;
            void GamNative.recordImpression({ adId: ad.adId }).catch(() => {});
            io.disconnect();
          }
        });
      },
      { threshold: [0.5] },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [ad?.adId]);

  if (!ready || !ad) return null;

  const open = () => {
    // Route through Google's click handler so the click is billable and the
    // landing page opens through the SDK.
    void GamNative.recordClick({ adId: ad.adId }).catch(() => {});
  };

  return (
    <Card
      ref={cardRef}
      className="overflow-hidden rounded-2xl border-border/60 shadow-sm"
      data-native-ad="1"
    >
      <div className="flex items-center gap-2 px-4 py-3">
        {ad.iconUrl ? (
          <img
            src={ad.iconUrl}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-muted" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">
            {ad.advertiser || 'Sponsored'}
          </div>
          <div className="text-xs text-muted-foreground">Sponsored</div>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 bg-foreground text-background">
          Ad
        </span>
      </div>

      {ad.imageUrl && (
        <button type="button" onClick={open} className="block w-full">
          <img
            src={ad.imageUrl}
            alt={ad.headline || ''}
            className="w-full h-auto object-cover"
          />
        </button>
      )}

      <div className="px-4 py-3 space-y-2">
        {ad.headline && (
          <div className="text-base font-semibold leading-snug">
            {ad.headline}
          </div>
        )}
        {ad.body && (
          <div className="text-sm text-muted-foreground leading-snug">
            {ad.body}
          </div>
        )}
        {ad.callToAction && (
          <button
            type="button"
            onClick={open}
            className="mt-1 inline-flex items-center rounded-full bg-foreground text-background px-4 py-1.5 text-sm font-medium"
          >
            {ad.callToAction}
          </button>
        )}
      </div>
    </Card>
  );
}

export default NativeFeedAd;
