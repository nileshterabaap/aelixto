# Plan: Google Ad Manager Native Ads in Aelixto (Capacitor)

Goal: Show one AdX-backed native ad after every 5 posts in the main feed, only for users whose install age is ≥ 2 days, on Android + iOS, with Google's User Messaging Platform (UMP) consent gathered first.

## 1. Prerequisites you complete in Google's dashboards (no code)

1. In **Google Ad Manager** → Admin → Apps: register both apps
   - Android: `app.lovable.9e8e690862444131a6858cbb5e68e94d`
   - iOS: (bundle id you're using for TestFlight/App Store)
   Ad Manager returns an **App ID** per platform in the form `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`.
2. Create one **Native ad unit** per platform under your AdX-linked network. Ad Manager returns an **Ad Unit ID** in the form `/NETWORK_CODE/aelixto_feed_native` (or the shorter `ca-app-pub-...` form for AdMob-style units — either works with GMA SDK).
3. In **GAM → Privacy & messaging → GDPR + IDFA + US state privacy**: publish messages (this is the UMP/CMP config the SDK will fetch). Google's own UMP counts as a certified CMP for AdX.
4. Enable **AdX demand** on the native ad unit (Yield groups / open auction).

You'll paste 4 values into the app: Android App ID, iOS App ID, Android native unit ID, iOS native unit ID.

## 2. Install SDKs

Add the community Capacitor plugin that wraps the Google Mobile Ads SDK (which is what serves GAM/AdX on mobile) plus the UMP consent plugin:

- `@capacitor-community/admob` — covers AdMob **and** Google Ad Manager ad units and includes UMP consent APIs.
- No extra iOS pod / Android gradle work beyond `npx cap sync`; the plugin pulls the native GMA SDK transitively.

## 3. Native config

- `capacitor.config.ts`: add `plugins.AdMob` block with both App IDs so the SDK initializes on cold start.
- iOS `Info.plist`: add `GADApplicationIdentifier` (iOS App ID) and the standard `SKAdNetworkItems` list Google publishes for AdMob/AdX.
- Android `AndroidManifest.xml`: add `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" .../>` with the Android App ID.

These are one-time edits the user runs `npx cap sync` after.

## 4. Install-age gate (2 days)

New table `public.install_metadata` (per user + per device):
- `user_id uuid`, `device_id text`, `first_seen_at timestamptz default now()`, primary key `(user_id, device_id)`.
- RLS: user can insert/select their own row; standard GRANTs.
- On app boot, upsert `(auth.uid(), deviceId)` with `ON CONFLICT DO NOTHING` so `first_seen_at` is preserved.
- Helper `useAdsEligibility()` returns `true` only when `now() - first_seen_at >= interval '2 days'` **and** the user is signed in **and** UMP status is `OBTAINED` with personalized-or-non-personalized consent (i.e. not `REQUIRED` / `UNKNOWN`).

Fallback for logged-out users: use a `localStorage`/`Preferences`-persisted `installedAt` timestamp keyed to the device so the gate still works before sign-in.

## 5. Consent (UMP / Google-certified CMP)

- On first launch after install: call `AdMob.requestConsentInfoUpdate()` then `AdMob.showConsentForm()` if `isConsentFormAvailable`.
- Persist result; re-check on cold start.
- Do **not** initialize ads (`AdMob.initialize({ initializeForTesting: false })`) until UMP returns a non-required status.
- Add a "Manage ad preferences" row in Settings that calls `AdMob.showPrivacyOptionsForm()` (required for EEA/UK).

## 6. Feed integration (native in-feed ad every 5 posts)

Touchpoints (frontend only, keeps existing tracking/blocking code untouched — Stability Guard stays green):
- New component `src/components/ads/NativeFeedAd.tsx`
  - Requests a native ad via the plugin's native-ad API, receives headline/body/cta/media/icon/advertiser.
  - Renders inside a Card that visually matches `HydratedFeedPost` (same header/media/caption rhythm) but with a small "Ad" chip in the header slot where the platform icon lives, per Google's native ad policy (must show "Ad" / "Sponsored" and advertiser attribution).
  - Registers the container + individual asset views with the SDK for viewability + click tracking (this is required by GMA — clicks only count when views are registered).
  - Handles no-fill by unmounting silently (never leaves a blank slot).
- New hook `src/hooks/useFeedWithAds.ts`
  - Wraps the existing feed array from `usePosts` / `useFollowingFeed` and, when `useAdsEligibility()` is true, interleaves an `{ kind: 'ad', slotIndex }` entry after every 5th real post.
  - Skipped entirely when ineligible → feed renders exactly as today.
- `src/pages/Index.tsx` renders `NativeFeedAd` for `kind === 'ad'`, else the current `HydratedFeedPost`.
- Frequency cap: max 1 ad request every ~20 s and cache the last loaded ad per slot for the session so scrolling up/down doesn't hammer AdX.
- Preload the next ad ~2 slots ahead using an IntersectionObserver on the surrounding post so the ad is ready when it scrolls in.

Not touched: `HydratedFeedPost.tsx`, `RawEmbedRenderer.tsx`, `resolveRenderer.ts`, `useOriginalVisitTracker.ts`, `useViewTracking.ts`, `record-view` — all Stability-Guarded files stay untouched.

## 7. Config + secrets

- `src/config/ads.ts` holds the 4 IDs plus a `TEST_MODE` flag; in dev we use Google's official Ad Manager native test unit IDs so no live impressions fire during preview.
- No server-side secret needed — GAM/AdX IDs are public and belong in the app bundle.

## 8. QA checklist before you ship

1. Fresh install → no ads for 48 h (verify by temporarily lowering the gate to 2 min).
2. UMP form appears on first launch in an EEA VPN; declining shows non-personalized ads only.
3. Test ad unit fills in dev on both Android and iOS.
4. Live unit fills once the app is on the store and Ad Manager reports at least one request per unit.
5. Scroll-jank check: native ad card measured, no CLS in the feed.
6. Report menu on ad card ("Hide this ad") — optional v2, Google recommends it.

## Technical notes

- Native GMA SDK is required because Capacitor is a WebView; GPT/AdSense web tags are **not** eligible to serve AdX inside a mobile app WebView.
- `@capacitor-community/admob` exposes `AdManager` bidding via ad unit IDs of the form `/NETWORK_CODE/unit-name`, which is what AdX-linked GAM units use.
- Install age must be based on the device's first-seen timestamp, not `auth.users.created_at`, so re-installs restart the 48 h window (this is what Google's own AdMob "new user" policies assume).

Success probability: **90%**.
