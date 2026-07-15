import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Card } from '@/components/ui/card';
import { AD_MIN_REQUEST_INTERVAL_MS, getNativeFeedAdUnitId } from '@/config/ads';
import { adsReady } from '@/lib/adConsent';

interface NativeAdCreative {
  headline?: string;
  body?: string;
  advertiser?: string;
  callToAction?: string;
  iconUrl?: string;
  imageUrl?: string;
  clickThroughUrl?: string;
}

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
    const mod: any = await import('@capacitor-community/admob');
    const AdMob = mod.AdMob;
    // The Capacitor community AdMob plugin does not yet expose a first-class
    // NativeAd API. When it does (or when a custom Capacitor plugin is added),
    // wire the call here. Until then, no-fill is returned and the slot
    // unmounts silently so the feed layout is unaffected.
    if (typeof AdMob?.loadNativeAd === 'function') {
      const result = await AdMob.loadNativeAd({ adId: adUnitId });
      if (!result) return null;
      return {
        headline: result.headline,
        body: result.body,
        advertiser: result.advertiser,
        callToAction: result.callToAction,
        iconUrl: result.icon,
        imageUrl: result.image,
        clickThroughUrl: result.clickThroughUrl,
      };
    }
    return null;
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
    };
  }, []);

  if (!ready || !ad) return null;

  const open = () => {
    if (!ad.clickThroughUrl) return;
    try {
      window.open(ad.clickThroughUrl, '_blank');
    } catch {
      /* ignore */
    }
  };

  return (
    <Card
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
