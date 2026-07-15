/**
 * UMP (Google-certified CMP) bootstrap.
 *
 * Called once on cold start from `initCapacitorPlugins`. Fetches consent
 * from Google Funding Choices (configured via GAM -> Privacy & messaging),
 * shows the form when required, then initializes the ads SDK. All
 * subsequent ad requests must wait for `adsReady()`.
 */

import { Capacitor } from '@capacitor/core';

let ready = false;
let readyPromise: Promise<boolean> | null = null;

export function adsReady(): Promise<boolean> {
  return readyPromise ?? Promise.resolve(ready);
}

export async function showPrivacyOptionsForm(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const mod: any = await import('@capacitor-community/admob');
    const AdMob = mod.AdMob;
    // v8 exposes showPrivacyOptionsForm; older versions use showConsentForm.
    if (typeof AdMob?.showPrivacyOptionsForm === 'function') {
      await AdMob.showPrivacyOptionsForm();
    } else if (typeof AdMob?.showConsentForm === 'function') {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    console.warn('[ads] showPrivacyOptionsForm failed', e);
  }
}

export function initAdsAndConsent(): Promise<boolean> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const mod: any = await import('@capacitor-community/admob');
      const AdMob = mod.AdMob;
      // 1. Ask UMP for the current consent status and fetch a form if needed.
      try {
        await AdMob.requestConsentInfo?.();
      } catch (e) {
        console.warn('[ads] requestConsentInfo failed', e);
      }
      try {
        // Only shows if a form is required + available (EEA/UK/US-CA users).
        await AdMob.showConsentForm?.();
      } catch {
        // Non-fatal — user may already have a stored decision.
      }
      // 2. iOS ATT prompt (SDK handles the OS dialog itself).
      try {
        await AdMob.trackingAuthorizationStatus?.();
        await AdMob.requestTrackingAuthorization?.();
      } catch {
        /* Android or already prompted */
      }
      // 3. Initialize the Google Mobile Ads SDK.
      await AdMob.initialize?.({
        initializeForTesting: true,
        testingDevices: [],
      });
      ready = true;
      return true;
    } catch (e) {
      console.warn('[ads] init failed', e);
      return false;
    }
  })();
  return readyPromise;
}
