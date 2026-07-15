# Google Ad Manager (AdX) — Native Ads

Ads are served by a **first-party Capacitor plugin** at
`capacitor-plugins/gam-native` that wraps:

- **iOS:** `Google-Mobile-Ads-SDK` (`GADAdLoader` + `GAMRequest`)
- **Android:** `play-services-ads` (`AdLoader.forNativeAd` + `AdManagerAdRequest`)
- **Consent:** `GoogleUserMessagingPlatform` / `user-messaging-platform`
  (Google-certified CMP via Funding Choices).

Because the request path is `GAMRequest` / `AdManagerAdRequest` and the unit
IDs are `/NETWORK_CODE/unit_name`, demand comes from **your Ad Manager
account**, including AdX open auction and any yield partners you've enabled.
There is no AdMob plugin in the tree.

## Configure IDs (2 places)

### 1. `src/config/ads.ts`
```ts
export const AD_TEST_MODE = false; // true keeps Google test creatives
const LIVE_NATIVE_ANDROID = '/NETWORK_CODE/aelixto_feed_native';
const LIVE_NATIVE_IOS     = '/NETWORK_CODE/aelixto_feed_native';
```

### 2. Native App IDs (after `npx cap sync`)

**`android/app/src/main/AndroidManifest.xml`** (inside `<application>`):
```xml
<meta-data
  android:name="com.google.android.gms.ads.APPLICATION_ID"
  android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
```

**`ios/App/App/Info.plist`**:
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
<key>NSUserTrackingUsageDescription</key>
<string>Aelixto uses this identifier to show more relevant ads.</string>
<key>SKAdNetworkItems</key>
<array>
  <!-- Paste Google's full list from
       https://developers.google.com/admob/ios/quick-start#update_your_infoplist -->
</array>
```

> The App ID is the AdMob-format app registration Google requires for the
> Mobile Ads SDK to initialize; the actual ad demand still comes from your
> Ad Manager unit IDs.

## One-time build steps

```bash
git pull
npm install
npx cap sync
cd ios/App && pod install && cd ../..   # iOS only
npx cap open android    # or: npx cap open ios
```

The plugin is picked up automatically because it's declared in
`package.json` as `aelixto-gam-native: file:capacitor-plugins/gam-native`,
which is how Capacitor discovers local plugins.

## Ad Manager dashboard checklist

- Admin → Apps → register the Android + iOS apps.
- Inventory → Ad units → create one **Native** unit per platform. Use those
  `/NETWORK_CODE/…` paths in `src/config/ads.ts`.
- Yield groups → enable AdX open auction on the units.
- Privacy & messaging → publish GDPR + IDFA + US-state messages (the UMP
  form the app fetches).

## Gating rules (all must be true before an ad request fires)

1. Running on Capacitor Android/iOS (never web).
2. UMP consent resolved + `MobileAds` initialized (`adsReady()`).
3. Install age ≥ 48 h — tracked in `public.install_metadata`, with a
   `localStorage` fallback for signed-out sessions.
4. Placement: one ad after every 5 posts (`AD_INTERVAL`).
5. Rate limit: ≥ 20 s between ad requests (`AD_MIN_REQUEST_INTERVAL_MS`).

Users can re-open their consent choices via **Settings → Manage ad
preferences** (native-only row).

## Impression / click reporting caveat

Google's SDK auto-fires impressions and clicks when creatives are rendered
inside a native `GADNativeAdView` / `NativeAdView`. Because our card is
drawn inside the webview, the plugin:

- Manually calls `nativeAd.recordImpression()` on iOS when the card crosses
  ≥ 50 % visibility (Google's viewability bar).
- On iOS, calls `performClickOnAsset(GADNativeCallToActionAsset)` for the
  CTA tap — that's the SDK-sanctioned path, so the click is billable and
  the landing page opens through Google's handler.
- Android's public `NativeAd` API doesn't expose an equivalent manual
  click hook. For full Android metrics + billable clicks, a follow-up is
  to render the card in a native `NativeAdView` overlay above the webview
  (small addition to the plugin's Java side). Impression tracking and
  demand routing already work end-to-end via `AdManagerAdRequest`.
