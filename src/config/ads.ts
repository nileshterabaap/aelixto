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

/**
 * Test mode is tied to Vite's DEV flag so it is *impossible* to ship test
 * ads in a production release bundle. `import.meta.env.DEV` is true only
 * when running against `vite dev` (Capacitor hot-reload against the Lovable
 * preview URL). `npm run build` — which is what every release APK/IPA is
 * built from — sets it to false, guaranteeing live Ad Manager IDs.
 */
export const AD_TEST_MODE = import.meta.env.DEV === true;

/**
 * Developer-only bypass for the 48h install-age gate. Same DEV guard as
 * above, so release builds always enforce the 48h gate.
 */
export const AD_DEV_BYPASS_INSTALL_AGE = import.meta.env.DEV === true;

// Official Google test IDs — safe to hit unlimited times in dev.
// See https://developers.google.com/admob/android/test-ads
const TEST_NATIVE_ANDROID = 'ca-app-pub-3940256099942544/2247696110';
const TEST_NATIVE_IOS     = 'ca-app-pub-3940256099942544/3986624511';

// Live Google Ad Manager (AdX) native ad units.
// Network code 23362049225.
const LIVE_NATIVE_ANDROID = '/23362049225/aelixto_feed_native_android';
const LIVE_NATIVE_IOS     = '/23362049225/aelixto_feed_native_ios';

// Live Google Ad Manager APPLICATION IDs (used by the native manifests, not
// the JS layer — exported here for documentation / single source of truth).
export const GAM_APP_ID_ANDROID = 'ca-app-pub-4944388830758437~6705238632';
export const GAM_APP_ID_IOS     = 'ca-app-pub-4944388830758437~4837623196';

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
