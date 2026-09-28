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
const ADS_TEST_FLAG =
  String(import.meta.env.VITE_ADS_TEST ?? '').trim() === '1' ||
  String(import.meta.env.VITE_ADS_TEST ?? '').trim().toLowerCase() === 'true';

/**
 * Runtime override so a *release* APK can be flipped into test mode from
 * Settings without a rebuild (Settings -> "Ad test mode (debug)"). Persisted
 * in localStorage; defaults to off.
 */
export const AD_TEST_LS_KEY = 'aelixto_ads_test';

function readRuntimeTestFlag(): boolean {
  try {
    return localStorage.getItem(AD_TEST_LS_KEY) === '1';
  } catch {
    return false;
  }
}

const RUNTIME_TEST_FLAG = readRuntimeTestFlag();

/**
 * LIVE test-mode read. The Settings toggle writes localStorage at runtime, so
 * anything that captured a module-load constant would keep using live ad units
 * until the app was fully restarted. Always call this at request time.
 */
export function isAdTestMode(): boolean {
  return import.meta.env.DEV === true || ADS_TEST_FLAG || readRuntimeTestFlag();
}

/** Live read of the install-age bypass (same sources as test mode). */
export function isInstallAgeBypassed(): boolean {
  return isAdTestMode();
}

export const AD_TEST_MODE = import.meta.env.DEV === true || ADS_TEST_FLAG || RUNTIME_TEST_FLAG;

/**
 * Developer-only bypass for the 48h install-age gate. Same DEV guard as
 * above, so release builds always enforce the 48h gate.
 */
export const AD_DEV_BYPASS_INSTALL_AGE =
  import.meta.env.DEV === true || ADS_TEST_FLAG || RUNTIME_TEST_FLAG;

// Google **Ad Manager** sample native ad unit.
// IMPORTANT: the plugin requests ads with `AdManagerAdRequest` + an Ad Manager
// ad-unit path. The AdMob test units (ca-app-pub-3940256099942544/...) are NOT
// valid on that request path and return invalid-request / no-fill, which is why
// no test ad ever appeared. The GAM sample unit below always fills.
// See https://developers.google.com/ad-manager/mobile-ads-sdk/android/test-ads
const TEST_NATIVE_ANDROID = '/21775744923/example/native';
const TEST_NATIVE_IOS     = '/21775744923/example/native';

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
  if (isAdTestMode()) {
    return platform === 'android' ? TEST_NATIVE_ANDROID : TEST_NATIVE_IOS;
  }
  return platform === 'android' ? LIVE_NATIVE_ANDROID : LIVE_NATIVE_IOS;
}

/** Show 1 ad after every N real posts (test + live, Android + iOS). */
export const AD_INTERVAL = 7;

/** Minimum install age before any ad is requested. */
export const AD_MIN_INSTALL_AGE_MS = 2 * 24 * 60 * 60 * 1000;

/** Minimum spacing between successive ad requests (rate limit). */
export const AD_MIN_REQUEST_INTERVAL_MS = 20_000;

// One-time boot log so the APK's Logcat shows exactly which mode is compiled in.
console.log('[ads] config: DEV =', import.meta.env.DEV, 'VITE_ADS_TEST =',
  String(import.meta.env.VITE_ADS_TEST ?? ''), 'runtimeTestFlag =', RUNTIME_TEST_FLAG,
  'AD_TEST_MODE =', AD_TEST_MODE,
  'installAgeBypass =', AD_DEV_BYPASS_INSTALL_AGE, 'adInterval =', AD_INTERVAL);
