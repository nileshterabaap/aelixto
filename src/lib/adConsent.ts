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
  return readyPromise ?? Promise.resolve(ready);
}

export async function showPrivacyOptionsForm(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await GamNative.showPrivacyOptionsForm();
  } catch (e) {
    console.warn('[ads] showPrivacyOptionsForm failed', e);
  }
}

export function initAdsAndConsent(): Promise<boolean> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      // 1. UMP consent (Google-certified CMP via Funding Choices).
      try {
        await GamNative.requestConsentInfo();
        await GamNative.showConsentFormIfRequired();
      } catch (e) {
        console.warn('[ads] consent flow failed', e);
      }
      // 2. iOS ATT prompt (Android returns "unavailable").
      try {
        await GamNative.requestTrackingAuthorization();
      } catch {
        /* non-fatal */
      }
      // 3. Initialize Google Mobile Ads SDK (Ad Manager APIs use the same SDK).
      await GamNative.initialize();
      ready = true;
      return true;
    } catch (e) {
      console.warn('[ads] init failed', e);
      return false;
    }
  })();
  return readyPromise;
}
