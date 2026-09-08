## Your goals (as I remember them)

1. **Monetize Aelixto with Google Ad Manager (AdX)** demand — not AdMob.
2. **Native in-feed ads only** — real native creatives (headline, media, CTA, advertiser), rendered inline in the feed, no banners / interstitials / rewarded.
3. **Placement cadence:** one ad after every **5 posts**.
4. **Install-age gate:** never show ads to a device whose install age is **< 48 h** (policy + quality signal).
5. **Consent:** Google-certified CMP via **UMP / Funding Choices** (GDPR / EEA-UK, US-state, IDFA on iOS).
6. **Android + iOS only** — web/PWA never requests ads.
7. **Full SDK-tracked impressions + billable clicks** through a real `NativeAdView` / `GADNativeAdView` overlay (already implemented in the custom `aelixto-gam-native` plugin).

If any of that is wrong, tell me and I'll adjust before we go live.

---

## Next steps now that AdX identity verification is approved

### Step 1 — Register both apps in Ad Manager (you, in the GAM dashboard)
- **Admin → Apps → New app** for Android package `com.aelixto.app10`.
- **Admin → Apps → New app** for iOS bundle (whatever the App Store Connect bundle ID is — confirm it with me if unsure).
- Copy each **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`). You'll paste these into `AndroidManifest.xml` and `Info.plist` in Step 4.

### Step 2 — Create the two Native ad units (you, in GAM)
- **Inventory → Ad units → New native unit** — one per platform:
  - `aelixto_feed_native_android`
  - `aelixto_feed_native_ios`
- Copy each fully-qualified path: `/NETWORK_CODE/aelixto_feed_native_android` and `/NETWORK_CODE/aelixto_feed_native_ios`.

### Step 3 — Turn on AdX demand + publish UMP messages (you, in GAM)
- **Yield → Yield groups** — enable **AdX open auction** on both native units. Add any additional yield partners you want to compete.
- **Privacy & messaging** — publish the **GDPR / EEA-UK**, **IDFA**, and **US-state** messages. This is exactly what the app's UMP call auto-fetches on first launch.

### Step 4 — Paste live IDs into the code (I do this once you send them)
Once you give me the 2 App IDs (Step 1) and the 2 ad-unit paths (Step 2), I will:
- Set `AD_TEST_MODE = false` and paste both ad-unit paths in `src/config/ads.ts`.
- Add the Android App ID `<meta-data>` in `android/app/src/main/AndroidManifest.xml`.
- Add `GADApplicationIdentifier`, `NSUserTrackingUsageDescription`, and the current `SKAdNetworkItems` list in `ios/App/App/Info.plist`.

### Step 5 — You rebuild the native binaries
```
git pull
npm install
npx cap sync
cd ios/App && pod install && cd ../..
```
Then open the native projects (`npx cap open android` / `npx cap open ios`) and build.

### Step 6 — On-device QA (before flipping to production)
Before Step 4 (so we're still on `AD_TEST_MODE = true` with Google's test unit IDs, which always fill), verify on a physical device:
- **UMP form** appears on first launch (or via **Settings → Manage ad preferences**).
- **ATT prompt** appears on iOS 14+ first launch.
- A native ad card appears after every 5 posts, only once the app is ≥ 48 h old (clear `aelixto_install_first_seen_at` in `localStorage` + the `install_metadata` row to reset the gate during QA).
- Tapping the **CTA** opens the landing page through Google's click handler.
- Tapping anywhere else on the card is inert (no accidental navigation).

### Step 7 — Store submissions
- **Play Console:** Data safety form — declare ads + IDFA-equivalent. Content rating → yes, contains ads.
- **App Store Connect:** privacy nutrition labels — declare IDFA use. In the submission notes, mention that the app shows the ATT prompt (already implemented). App review sometimes asks; be ready to point them at the "Manage ad preferences" screen.

### Step 8 — Go live + monitor
- After Step 4 is merged and Step 5 rebuild is submitted and approved, ads request against your real inventory.
- **First 24 h:** fill rate is usually low while AdX learns your inventory — this is normal.
- Watch **Ad Manager → Reports** for impressions, fill rate, eCPM. Add more yield partners in GAM as needed — **no more code changes required**.

---

## What I need from you to move forward

- The **2 GAM App IDs** (Android + iOS) from Step 1.
- The **2 native ad-unit paths** (Android + iOS) from Step 2.
- Confirmation the **iOS bundle ID** is what's registered in App Store Connect.

Send those and I'll wire everything in one turn.

Success probability once live IDs are pasted and native rebuild ships: **93%**.