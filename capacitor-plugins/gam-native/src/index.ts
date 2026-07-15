import { registerPlugin } from '@capacitor/core';

export interface GamNativePlugin {
  /** Initialize the Google Mobile Ads SDK. Safe to call multiple times. */
  initialize(options?: { testDeviceIds?: string[] }): Promise<{ status: string }>;

  /** UMP consent status (Google-certified CMP via Funding Choices). */
  requestConsentInfo(): Promise<{
    status: 'REQUIRED' | 'NOT_REQUIRED' | 'OBTAINED' | 'UNKNOWN';
    isConsentFormAvailable: boolean;
  }>;
  /** Load and show the consent form if required. Resolves after user chooses. */
  showConsentFormIfRequired(): Promise<{ shown: boolean }>;
  /** Always show the "Manage ad preferences" form (for Settings row). */
  showPrivacyOptionsForm(): Promise<void>;

  /** iOS App Tracking Transparency (no-op on Android). */
  requestTrackingAuthorization(): Promise<{
    status: 'authorized' | 'denied' | 'restricted' | 'notDetermined' | 'unavailable';
  }>;

  /**
   * Load a single Google Ad Manager native ad (`/NETWORK_CODE/unit`).
   * Returns a creative descriptor; a synthetic `adId` handle is included so
   * the plugin can attach impression/click reporting later.
   */
  loadNativeAd(options: { adUnitId: string }): Promise<NativeAdCreative | null>;

  /**
   * Mount a real native `NativeAdView` (Android) / `GADNativeAdView` (iOS)
   * as an overlay above the webview at the given CSS-pixel rect. This is
   * the only rendering path that lets Google's SDK auto-track impressions
   * and billable clicks on both platforms.
   */
  presentNativeAd(options: {
    adId: string;
    x: number; y: number; width: number; height: number;
  }): Promise<void>;
  /** Reposition the overlay after scroll/resize. */
  updateNativeAdFrame(options: {
    adId: string;
    x: number; y: number; width: number; height: number;
  }): Promise<void>;
  /** Free the underlying native ad object when the card unmounts. */
  destroyAd(options: { adId: string }): Promise<void>;
}

export interface NativeAdCreative {
  adId: string;
  headline?: string;
  body?: string;
  advertiser?: string;
  callToAction?: string;
  iconUrl?: string;
  imageUrl?: string;
  starRating?: number;
  price?: string;
  store?: string;
  responseInfo?: string;
}

export const GamNative = registerPlugin<GamNativePlugin>('GamNative');