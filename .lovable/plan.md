# Threads engagement tracking — Play + Visit

Bring Threads inline tracking to parity with X. All changes are scoped to Threads only; YouTube/TikTok/IG/FB/LinkedIn/Pinterest/Spotify behavior is unchanged.

## What will change

1. **First interaction with the Threads iframe → `video_play` (+1)**
   - Same signal path YouTube/TikTok/IG rely on: parent `window.blur` + `document.activeElement` is the Threads iframe.
   - Plus a mobile-safe pointer-coordinate fallback for browsers where `activeElement` doesn't update in time.
   - Fires once per post per cooldown (backend already dedups).

2. **App backgrounded shortly after a Threads iframe interaction → `original_visit` (+1)**
   - Same one-line pattern used for X: allow the `visibilitychange → hidden` fallback for Threads posts specifically.
   - Fires once per post per cooldown.

## Files to edit

Only one file, no DB or edge-function changes:

- `src/hooks/useOriginalVisitTracker.ts`
  - Add `isThreadsPost()` helper (mirrors existing `isXPost()`), matching `iframe[src*="threads.net"]` and `iframe[src*="threads.com"]`.
  - In `onPointerDown`: when `trackPlayableInteraction && isThreadsPost()`, also treat a pointerdown whose coordinates fall inside the Threads iframe's bounding rect as a play (covers the case where the event target is the iframe but the mobile browser doesn't set `document.activeElement` yet).
  - In `onWindowBlur`: keep existing logic; it already fires `firePlay` when the iframe becomes the active element.
  - In `onVisibilityChange`: extend the existing X-only exception to also allow `isThreadsPost()`, so `original_visit` fires when the user leaves the app within 3s of a Threads interaction.

No changes to `useViewTracking.ts`, `record-view`, `HydratedEmbed.tsx`, or `UniversalMetaEmbed.tsx`.

## Accepted tradeoff (same envelope as X)

- Any first tap on the Threads player counts as a play, even if the user actually tapped mute/scrub/fullscreen. Never double-counts (cooldown).
- Any app-background within 3s of a Threads tap counts as a Visit, even if the user switched apps for an unrelated reason. Same behavior X already has.

## Out of scope

- No changes to the header platform-icon Visit button (still works as-is).
- No changes to non-Threads platforms.
- Diagnostic `trace_logs` table / `traceLog` helper stay in place for now; can be removed in a follow-up cleanup once you've confirmed Threads counts are landing.

Success probability: **90%**.
