/**
 * Google Ad Manager (AdX) configuration for Aelixto.
 *
 * Native ads are served via the Google Mobile Ads SDK on Android + iOS only.
 * The web/PWA build never requests ads.
 *
 * Replace the placeholder IDs below with the real Ad Manager values:
 *   - App IDs from Ad Manager -> Admin -> Apps
 *   - Native ad-unit IDs from Ad Manager -> Inventory -> Ad units
 *
 * IDs are public identifiers (safe to ship in the client bundle).
 */

export const AD_TEST_MODE = true; // flip to false once live IDs are wired

// Official Google test IDs — safe to hit unlimited times in dev.
// See https://developers.google.com/admob/android/test-ads
const TEST_NATIVE_ANDROID = 'ca-app-pub-3940256099942544/2247696110';
const TEST_NATIVE_IOS     = 'ca-app-pub-3940256099942544/3986624511';

// TODO: paste live Ad Manager native unit IDs here.
const LIVE_NATIVE_ANDROID = '';
const LIVE_NATIVE_IOS     = '';

export function getNativeFeedAdUnitId(platform: 'android' | 'ios' | 'web'): string {
  if (platform === 'web') return '';
  if (AD_TEST_MODE) {
    return platform === 'android' ? TEST_NATIVE_ANDROID : TEST_NATIVE_IOS;
  }
  return platform === 'android' ? LIVE_NATIVE_ANDROID : LIVE_NATIVE_IOS;
}

/** Show 1 ad after every N real posts. */
export const AD_INTERVAL = 5;

/** Minimum install age before any ad is requested. */
export const AD_MIN_INSTALL_AGE_MS = 2 * 24 * 60 * 60 * 1000;

/** Minimum spacing between successive ad requests (rate limit). */
export const AD_MIN_REQUEST_INTERVAL_MS = 20_000;
