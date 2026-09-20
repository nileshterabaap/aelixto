import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * In-app store rating prompt (Google Play In-App Review / Apple SKStoreReview).
 *
 * Rules:
 *  - Native Android/iOS only (never on web/PWA).
 *  - Shown only after 24 h have passed since the first launch on this device.
 *  - Asked at most once; the OS may also silently ignore it (quota).
 *  - Delayed a few seconds after launch so it never interrupts startup.
 */

// First-launch timestamp used only for the 24-hour store-review delay.
const LS_INSTALL_KEY = 'aelixto_install_first_seen_at';
const LS_REVIEW_ASKED_KEY = 'aelixto_review_asked_at';

const REVIEW_MIN_INSTALL_AGE_MS = 24 * 60 * 60 * 1000;
const REVIEW_DELAY_MS = 8000;

function getInstallAgeMs(): number {
  try {
    let v = localStorage.getItem(LS_INSTALL_KEY);
    if (!v) {
      v = String(Date.now());
      localStorage.setItem(LS_INSTALL_KEY, v);
    }
    return Date.now() - Number(v);
  } catch {
    return 0;
  }
}

function alreadyAsked(): boolean {
  try {
    return !!localStorage.getItem(LS_REVIEW_ASKED_KEY);
  } catch {
    return true;
  }
}

export async function requestStoreReview(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
    try {
      localStorage.setItem(LS_REVIEW_ASKED_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.warn('[review] requestReview failed', e);
  }
}

export function useAppReviewPrompt(): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (alreadyAsked()) return;
    if (getInstallAgeMs() < REVIEW_MIN_INSTALL_AGE_MS) return;

    const t = setTimeout(() => {
      void requestStoreReview();
    }, REVIEW_DELAY_MS);

    return () => clearTimeout(t);
  }, []);
}
