/**
 * UMP (Google-certified CMP) bootstrap.
 *
 * Called once on cold start from `initCapacitorPlugins`. Fetches consent
 * from Google Funding Choices (configured via GAM -> Privacy & messaging),
 * shows the form when required, then initializes the ads SDK. All
 * subsequent ad requests must wait for `adsReady()`.
 */

import { Capacitor } from '@capacitor/core';
import { GamNative } from 'aelixto-gam-native';

let ready = false;
let readyPromise: Promise<boolean> | null = null;

export function adsReady(): Promise<boolean> {
  if (!readyPromise) {
    // Race fix: eligibility/slots can call adsReady() before
    // initCapacitorPlugins() has kicked off consent+SDK init. Previously that
    // returned `false` forever (the hook never re-ran), so no ad ever loaded.
    console.log('[ads] adsReady() called before init — starting init now');
    return initAdsAndConsent();
  }
  return readyPromise.then((v) => {
    console.log('[ads] adsReady() resolved =', v);
    return v;
  });
}

export async function showPrivacyOptionsForm(): Promise<{ ok: boolean; message: string }> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[ads] showPrivacyOptionsForm skipped: not native');
    return { ok: false, message: 'Ad preferences are only available in the app.' };
  }
  try {
    // Log the current consent state first — the privacy options form only
    // exists when the UMP/Funding Choices privacy message is published AND
    // the user is in a region where it applies.
    try {
      const info = await GamNative.requestConsentInfo();
      console.log('[ads] privacy options: consent info =', JSON.stringify(info));
    } catch (e) {
      console.warn('[ads] privacy options: consent info failed', e);
    }
    await GamNative.showPrivacyOptionsForm();
    console.log('[ads] showPrivacyOptionsForm resolved');
    return { ok: true, message: '' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[ads] showPrivacyOptionsForm failed:', message);
    return { ok: false, message };
  }
}

export function initAdsAndConsent(): Promise<boolean> {
  if (readyPromise) {
    console.log('[ads] initAdsAndConsent() already started');
    return readyPromise;
  }
  console.log('[ads] initAdsAndConsent() start; native =', Capacitor.isNativePlatform(), 'platform =', Capacitor.getPlatform());
  readyPromise = (async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[ads] not a native platform — ads disabled');
      return false;
    }
    try {
      // 1. UMP consent (Google-certified CMP via Funding Choices).
      try {
        const info = await GamNative.requestConsentInfo();
        console.log('[ads] consent info:', JSON.stringify(info));
        const formResult = await GamNative.showConsentFormIfRequired();
        console.log('[ads] consent form result:', JSON.stringify(formResult));
      } catch (e) {
        console.warn('[ads] consent flow failed', e);
      }
      // 2. iOS ATT prompt (Android returns "unavailable").
      try {
        const att = await GamNative.requestTrackingAuthorization();
        console.log('[ads] ATT status:', JSON.stringify(att));
      } catch {
        /* non-fatal */
      }
      // 3. Initialize Google Mobile Ads SDK (Ad Manager APIs use the same SDK).
      const init = await GamNative.initialize();
      console.log('[ads] SDK initialize result:', JSON.stringify(init));
      ready = true;
      console.log('[ads] adsReady state -> true');
      return true;
    } catch (e) {
      console.warn('[ads] init failed', e);
      console.log('[ads] adsReady state -> false (init failed)');
      return false;
    }
  })();
  return readyPromise;
}
