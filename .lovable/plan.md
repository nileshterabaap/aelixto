# Restore Threads `video_play` via one-shot capture overlay

## Diagnosis (confirmed by reading `src/hooks/useOriginalVisitTracker.ts`)

- The Threads-only capture layer still exists as a function (`attachThreadsPlayCapture`, lines 315–322) but its body is **intentionally stubbed to a no-op**, with the comment: *"Overlay capture disabled: it swallowed the first tap on the native Play button…"*.
- Nothing else in the client reliably fires `firePlay()` for Threads on mobile:
  - `pointerdown` / `touchstart` on the container do not bubble out of a cross-origin Threads iframe on mobile Chrome/WebView.
  - The `iframe.focus` listener rarely fires cross-origin on mobile.
  - The `window.blur` fallback (line 191) is gated on `lastThreadsCaptureRef.postId === postId` set within 1200 ms — and that ref is only written inside `fireThreadsPlayOnce()`, which is only called from the paths above. So on mobile the guard is unreachable and the blur handler returns at line 202–203.
- Net effect: **the client never sends `video_play` to `record-view` for Threads**. This is a client emission regression, not a `record-view` bug.

**Regressing change:** the "let taps pass straight through to the iframe" refactor that stubbed `attachThreadsPlayCapture`. That was the last known working trigger and nothing replaced it with an equivalent one.

## Fix — restore the one-shot capture overlay (edit only `src/hooks/useOriginalVisitTracker.ts`)

Reimplement `attachThreadsPlayCapture(iframe)` so it:

1. Only runs when `trackPlayableInteraction` is true and the iframe is Threads.
2. Positions the iframe's parent as `position: relative` if it isn't already, then inserts a sibling `<div>` overlay that:
   - Is absolutely positioned to exactly cover the iframe rect (`inset: 0`).
   - Has `background: transparent`, `z-index: 2`, `touch-action: manipulation`, and `cursor: pointer`.
   - Has `pointer-events: auto` initially.
3. On the **first** `touchstart` (capture, passive) or `pointerdown` (capture) on the overlay:
   - Calls `fireThreadsPlayOnce()` synchronously.
   - Immediately removes the overlay from the DOM in the same tick (`overlay.remove()`), so the **same** tap sequence's subsequent `touchend` / `click` lands on the native Threads Play button underneath. Because the overlay is gone before the browser dispatches the click, Threads' native player receives the tap and starts playback — this is the same mechanism that worked in the last-known-working build.
4. Registers a cleanup that removes the overlay if the effect tears down before the tap arrives, and pushes it into `threadsCaptureCleanups` (already wired at line 394).
5. Uses `threadsCaptureAttached` (already declared, line 313) so we don't attach twice to the same iframe when the MutationObserver re-visits it.
6. Skips attachment entirely if the parent already contains an overlay with `data-threads-play-capture="1"` (idempotency across React re-renders / stability guard).

No other files change. `firePlay()`, `fireThreadsPlayOnce()`, the play dedupe set `threadsVideoPlayFiredPosts`, `record-view`'s Threads burst guard, and the unique index in the database all remain exactly as they are — they were correct; they just weren't being reached.

## Verification steps after implementation

1. Open a Threads post in the feed and tap the Play button once.
   - Expected: video starts playing on the first tap (overlay removes itself in the same tick, tap reaches native control).
2. Check Network → confirm one POST to `record-view` with `event_type: "video_play"` fires for that post's id.
3. Confirm the Aelix Score for that post increments by exactly **1** (View 1 + Play 1 + Visit 0 = 2 total) after a first-time viewer session.
4. Tap the same post again — no second `video_play` should be sent (guarded by `threadsVideoPlayFiredPosts` + DB unique index).
5. Tap the platform icon in the header — should still fire `original_visit` (+1) exactly as before.
6. Verify other platforms (X, YouTube, TikTok, Instagram, Facebook, LinkedIn, Pinterest, Spotify) are untouched — no code path outside the Threads branch changes.

## Stability guard

`useOriginalVisitTracker.ts` is currently locked. I will re-approve the baseline after the edit is in and verified.

## Success probability
**~93%.** The overlay mechanism is exactly what worked before. The only risk is that Threads' current SDK renders the Play button in a subtly different hit region than a year ago — if the first tap after this change plays *but* doesn't score, we widen the overlay to `inset: -4px`. If it scores *but* doesn't play, we swap `overlay.remove()` for a `pointer-events: none` toggle plus removal on the next animation frame.
