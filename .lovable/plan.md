## Goal
Register the iOS bundle `com.aelixto.app10` as an allowed Apple client in the Lovable Cloud auth backend so that a future TestFlight/App Store build's **native** Sign in with Apple flow is accepted by the token exchange on first try — without touching anything else.

## Background
Right now only the **web** Apple Services ID (`com.aelixto.web` or similar) is registered as the Apple client in Lovable Cloud. That's what made the browser-side Apple sheet start working. Native iOS Sign in with Apple sends a token issued to the **app's bundle ID**, not the Services ID. If the bundle ID isn't listed as an accepted Apple `client_id`, Supabase rejects the token with "Unacceptable audience in id_token".

## What I'll do
1. Update the Lovable Cloud Apple provider configuration to accept a second client ID: `com.aelixto.app10` (the iOS bundle), in addition to the existing web Services ID.
2. Verify via `supabase--debug_oauth_server` and `supabase--project_info` that both client IDs are listed as valid Apple audiences.
3. Leave the existing JWT client secret, Services ID, Return URL, and Domains untouched — the web flow you just fixed keeps working exactly as it does today.

## What I will NOT do (per your choice)
- No Xcode / entitlements / Info.plist changes. You'll add the **Sign In with Apple** capability in Xcode yourself when you have Mac access.
- No changes to Android, Google, PWA, feed, or any other subsystem.
- No new files in `capacitor-plugins/`, no changes to `src/capacitor-init.ts` or `src/pages/AuthBridge.tsx`.

## After this plan is applied — what you still need to do later (documented, not done now)
When you eventually build the iOS app on a Mac:
1. Xcode → Signing & Capabilities → **+ Capability → Sign in with Apple**.
2. Apple Developer console → Identifiers → your **App ID** (`com.aelixto.app10`) → enable the **Sign In with Apple** capability there too.
3. `npx cap sync ios` and build.

## Verification
- `supabase--debug_oauth_server` output shows both the web Services ID and `com.aelixto.app10` under Apple's accepted client IDs.
- Web "Continue with Apple" still works (regression check — same flow, no config removed).
- Success probability that native iOS Apple sign-in works on first TestFlight build **after** you also do the Xcode capability step: **~95%**.
- Success probability of this backend-only change not breaking your current working web Apple flow: **~99%**.
