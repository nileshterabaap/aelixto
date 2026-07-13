## Goal
Restore the previously working behavior where tapping an embedded X post credits exactly one `original_visit` via the `visibilitychange → hidden` fallback, without changing any other platform.

## Root cause
In `src/hooks/useOriginalVisitTracker.ts`, `onVisibilityChange` currently early-returns for *all* playable posts:

```ts
if (trackPlayableInteraction) return;
```

This blanket return was added during the Threads work and unintentionally removed the X-only exception that used to allow `fireOriginal()` when the tab went hidden shortly after a pointerdown on the X iframe.

## Change (single file, ~3 lines)

**File:** `src/hooks/useOriginalVisitTracker.ts`
**Function:** `onVisibilityChange`

Replace:
```ts
if (trackPlayableInteraction) return;
```
with:
```ts
// Playable posts must not infer Visit from app-backgrounding, EXCEPT X:
// the X embed reliably hands the user to twitter.com / the X app on tap,
// and the visibility fallback is the only signal that fires on mobile.
if (trackPlayableInteraction && !isXPost()) return;
```

Nothing else changes:
- Threads capture overlay, `fireThreadsPlayOnce`, burst guard — untouched.
- `onPointerDown`, `onWindowBlur`, `onClick`, iframe focus handlers — untouched.
- YouTube, TikTok, Instagram, Facebook, LinkedIn, Pinterest, Spotify — still hit the early return (unchanged behavior).
- The existing `recentPointerRef` / `lastIframeInteractionRef` time windows already prevent stray fires, so no additional guard is needed.

## Verification
1. Tap an embedded X post → app backgrounds to X → return: expect exactly `image_view +1` and `original_visit +1` (no duplicate visits, no play).
2. Tap a Threads post → expect `video_play +1` only (no visit) — unchanged.
3. Scroll past YouTube/TikTok/IG/FB posts without tapping → no visit fires — unchanged.

## Stability lock
`useOriginalVisitTracker.ts` is a protected file. After the edit + verification, run `npm run stability:approve` to update the baseline.

Success probability: **95%**.
