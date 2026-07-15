# Google Ad Manager (AdX) — Native In-Feed Ads

This project ships the plumbing for Google Ad Manager native ads via
`@capacitor-community/admob`. All frontend, RLS, install-age gating, and
consent flow are wired. Only the four IDs below and the native-platform
config still need to be filled in before real ads can serve.

## 1. Paste your IDs

### `capacitor.config.ts` → `plugins.AdMob`
Replace the two test App IDs with the values Ad Manager gave you under
**Admin → Apps**:

```ts
appIdAndroid: 'ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY',
appIdIos:     'ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY',
```

### `src/config/ads.ts`
```ts
export const AD_TEST_MODE = false;
const LIVE_NATIVE_ANDROID = '/NETWORK_CODE/aelixto_feed_native';
const LIVE_NATIVE_IOS     = '/NETWORK_CODE/aelixto_feed_native';
```

## 2. Native platform config

After `npx cap sync`, edit:

### `android/app/src/main/AndroidManifest.xml`
Inside `<application>`:
```xml
<meta-data
  android:name="com.google.android.gms.ads.APPLICATION_ID"
  android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
```

### `ios/App/App/Info.plist`
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
<key>NSUserTrackingUsageDescription</key>
<string>Aelixto uses this identifier to show more relevant ads.</string>
<key>SKAdNetworkItems</key>
<array>
  <!-- Paste Google's full SKAdNetworkItems list from
       https://developers.google.com/admob/ios/quick-start#update_your_infoplist -->
</array>
```

## 3. GAM dashboard checklist

- Admin → Apps → register Android + iOS apps.
- Inventory → Ad units → create one **Native** unit per platform.
- Yield groups → enable AdX open auction on those units.
- Privacy & messaging → publish GDPR + IDFA + US-state messages (UMP form).

## 4. How the app decides whether to show an ad

All conditions must be true:

1. Running on Android or iOS via Capacitor (never web).
2. UMP consent resolved and Google Mobile Ads SDK initialized
   (`initAdsAndConsent` in `src/lib/adConsent.ts`).
3. Install age ≥ 48 h — tracked in `public.install_metadata`
   (per user + device) with a `localStorage` fallback for signed-out use.
4. Placement: every 5th post in the main feed
   (see `AD_INTERVAL` in `src/config/ads.ts`).
5. Rate limit: no more than one ad request per 20 s
   (`AD_MIN_REQUEST_INTERVAL_MS`).

Users can revisit their consent via
**Settings → Manage ad preferences** (native-only row).

## 5. Native ad rendering caveat

`@capacitor-community/admob` v8 supports Banner / Interstitial / Rewarded
out of the box. Full native-ad rendering requires either:

- A newer plugin version that exposes `AdMob.loadNativeAd`, or
- A small custom Capacitor plugin that wraps `GADNativeAd` (iOS) and
  `NativeAd` (Android).

`NativeFeedAd.tsx` already calls `AdMob.loadNativeAd({ adId })` and renders
the returned creative. When the method isn't present, the component
returns `null` and the feed renders exactly as it does today — no layout
shift, no visible placeholder.

Recommended next step once IDs are in: adopt
[`admob-plus-capacitor`](https://github.com/admob-plus/admob-plus) or a
bespoke plugin to fulfill the native ad request.
