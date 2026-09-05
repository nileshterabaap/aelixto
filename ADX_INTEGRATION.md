# Google Ad Manager (AdX) — Native Ads

All ad demand is served by our first-party Capacitor plugin
`aelixto-gam-native` (`capacitor-plugins/gam-native`). It uses **Google Ad
Manager APIs only** — never AdMob:

| Platform | Request path | SDK |
|---|---|---|
| iOS     | `GADAdLoader` + `GAMRequest` + `GADNativeAdView` overlay | `Google-Mobile-Ads-SDK` |
| Android | `AdLoader.forNativeAd` + `AdManagerAdRequest` + `NativeAdView` overlay | `play-services-ads` |
| Consent | UMP (Google-certified CMP) | `GoogleUserMessagingPlatform` / `user-messaging-platform` |

Impressions and billable clicks are auto-fired by the SDK because the
creative is rendered inside a real `NativeAdView` overlay positioned on top
of the webview at the JS card's rect. There is **no manual `recordImpression`
or `performClickOnAsset` workaround** on either platform.

---

## Manual steps you still need to do

### 1. Google Ad Manager dashboard

1. **Admin → Apps** — register the Android app (`com.aelixto.app10`) and the
   iOS app. Copy each **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`
   format). Keep them for step 3.
2. **Inventory → Ad units** — create one **Native** unit per platform, e.g.
   `aelixto_feed_native_android` and `aelixto_feed_native_ios`. Copy the
   fully-qualified paths (`/NETWORK_CODE/aelixto_feed_native_...`). Keep
   them for step 2.
3. **Yield → Yield groups** — enable **AdX open auction** on both units and
   any yield partners you want to compete.
4. **Privacy & messaging** — publish the **GDPR / EEA-UK**, **IDFA**, and
   **US-state** messages. This is the UMP form the app auto-fetches.

### 2. `src/config/ads.ts` — already wired

Live IDs are baked in:

```ts
// Network code 23362049225
LIVE_NATIVE_ANDROID = '/23362049225/aelixto_feed_native_android';
LIVE_NATIVE_IOS     = '/23362049225/aelixto_feed_native_ios';
GAM_APP_ID_ANDROID  = 'ca-app-pub-4944388830758437~6705238632';
GAM_APP_ID_IOS      = 'ca-app-pub-4944388830758437~4837623196';
```

`AD_TEST_MODE` and `AD_DEV_BYPASS_INSTALL_AGE` are both tied to
`import.meta.env.DEV`, so:

- `vite dev` / Capacitor hot-reload → test ads, no 48h gate (fast QA).
- `npm run build` (every release APK/IPA) → live Ad Manager IDs, 48h gate on.

### 3. Native app IDs (after `npx cap sync`)

**Android — nothing to do.** The plugin's own library manifest
(`capacitor-plugins/gam-native/android/src/main/AndroidManifest.xml`) already
declares:

```xml
<meta-data
  android:name="com.google.android.gms.ads.APPLICATION_ID"
  android:value="ca-app-pub-4944388830758437~6705238632"/>
```

The manifest merger folds this into `android/app/build/intermediates/merged_manifests/.../AndroidManifest.xml`,
which is what `MobileAdsInitProvider` reads at process start. Without it the
app crashes before launch with `IllegalStateException: Missing application ID`.
Verify after a build:

```bash
grep -r "ads.APPLICATION_ID" android/app/build/intermediates/merged_manifests/
```

If `android/app/src/main/AndroidManifest.xml` also declares this key, it must
use the same value or the merge fails with a conflict.

**`ios/App/App/Info.plist`**:

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-4944388830758437~4837623196</string>

<key>NSUserTrackingUsageDescription</key>
<string>Aelixto uses this identifier to show more relevant ads.</string>

<key>SKAdNetworkItems</key>
<array>
  <!-- Paste Google's current SKAdNetwork list:
       https://developers.google.com/admob/ios/quick-start#update_your_infoplist
       (same list applies to the Mobile Ads SDK when used with Ad Manager) -->
</array>
```

> The App ID is the app-registration identifier the Mobile Ads SDK needs to
> initialize. Ad **demand** still comes from your Ad Manager `/NETWORK_CODE/…`
> ad units — this is Ad Manager (AdX), not AdMob.

### 4. Build & sync

```bash
git pull
npm install
npx cap sync
cd ios/App && pod install && cd ../..   # iOS only
npx cap open android    # or: npx cap open ios
```

The plugin is picked up automatically via `package.json`:
`"aelixto-gam-native": "./capacitor-plugins/gam-native"`.

### 5. Testing

- Keep `AD_TEST_MODE = true` for the first on-device run. The plugin ships
  with Google's official test unit IDs; test creatives always fill.
- Verify **UMP form** appears once on first launch (or force it via
  Settings → Manage ad preferences).
- Verify **ATT prompt** appears on iOS 14+ first launch.
- Verify a native ad card appears after every 5 posts once the app has been
  installed ≥ 48 h (or clear `localStorage`'s `aelixto_install_first_seen_at`
  and the `install_metadata` row to reset the gate during QA).
- Tap the CTA — the landing page opens through Google's click handler and
  the click is billable on both platforms.
- Ad Manager → Reports should show impressions and clicks within ~1 hour.

### 6. Production rollout

1. Set `AD_TEST_MODE = false` and paste the live ad-unit IDs from step 2.
2. Set the real App IDs from step 3 in `AndroidManifest.xml` + `Info.plist`.
3. `npx cap sync`, rebuild release binaries, submit to Play Store / App
   Store review.
4. iOS review: mention IDFA usage (ATT prompt is already implemented).
5. Monitor Ad Manager fill rate + eCPM for the first 24 h. Add yield
   partners in Ad Manager as needed — no code changes required.

---

## Runtime gating (already implemented — for reference)

All must be true before any ad is requested:

1. Running on Capacitor Android/iOS (never web).
2. UMP consent resolved + `MobileAds` initialized (`adsReady()`).
3. Install age ≥ 48 h — tracked in `public.install_metadata`, with a
   `localStorage` fallback for signed-out sessions.
4. Placement: one ad after every 5 posts (`AD_INTERVAL`).
5. Rate limit: ≥ 20 s between successive ad requests
   (`AD_MIN_REQUEST_INTERVAL_MS`).

Users can re-open their consent choices via **Settings → Manage ad
preferences**.