# Project architecture

- The shared loading mark animates separate HTML compositor layers around static SVG artwork rather than SVG groups, avoiding per-frame SVG painting during native embed loading.

- Home opening slots use a presentation-only whole-card gate, load mounted children concurrently, and reveal in feed order; native ads reserve their opening slot and fade their complete SDK overlay after presentation, without altering protected playback/scoring or feed refresh rules.

- Home keeps a stable session snapshot: mutation/realtime invalidations never refetch it, loading readiness never reorders it, and foreground recovery distinguishes actual background return from iframe focus/network events so only app entry or explicit top refresh replaces it.

- Native startup keeps the OS launch screen logo-free (patched by `scripts/blank-native-splash.mjs` inside `assets:generate`, since `android/` is local-only) until the WebView paints, then hands off to the animated HTML splash; its visible interval starts after the bounded native hide/fade completes so slow bridges cannot hide the animation.
- Media lifecycle is keyed by post and playback generation: play candidates remain repeatable after rejected swipe gestures, every confirmed play synchronously arms that post, and starting another video immediately pauses the previous one; score deduplication must never consume lifecycle detection.
- Platform-specific block viewers keep only the landed post's player mounted and use empty scroll-snap neighbours for motion; fresh selection matches a direct grid opening without changing shared embed/scoring logic, while other viewers retain full-list anchored scrolling.
- Grid position uses a read-only dial derived from rendered post ranks, isolated from media lifecycle and persistence so displaying position never records activity.
- Keep only runtime-referenced artwork in `public/`; native icon/splash generation reads `resources/`, so unused public duplicates unnecessarily enlarge every installed app.
- Both post renderers use the shared visibility-gated liked-by summary with viewer-scoped query caches and existing RLS-protected reads; social context stays separate from media lifecycle and scoring.
- Both source-validation entry points share Instagram evidence and restoration cleanup; bounded scheduled rechecks remove only source-deletion notices after positive availability evidence, never moderation notices or the posts themselves.- iOS lives in committed `ios/` (Swift Package Manager); local plugins under `capacitor-plugins/` must ship a `Package.swift` with `CAPBridgedPlugin`, and Xcode targets/entitlements/Share Extension are applied by `scripts/ios/configure-xcode.rb` in `codemagic.yaml`, because Linux sandboxes cannot edit Xcode targets reliably.

- Native ID-token sign-in only works for a provider whose client ID the backend holds; Lovable Cloud stores a single Google client ID (the web one), so iOS Google sign-in must use the browser OAuth flow while Android keeps Credential Manager.
