## Goal
Emit exactly one `original_visit` when a Threads embed tap opens the original Threads post, without touching the working `image_view` or `video_play` code paths.

Success probability: **85%**.

## Why a new signal is needed
The Threads embed is a cross-origin iframe. The parent page cannot see which region was tapped (Play button vs. post header/username/timestamp that opens the original). The only reliable "the user left the app to view the original" signal is `document.visibilitychange → hidden` shortly after an interaction with the Threads iframe.

We removed this earlier because it double-credited Visit alongside Play. That is no longer a concern: Play now fires synchronously via the first-tap overlay, so we can treat "hidden after interaction" as Visit with `firedRef` dedup ensuring at most one per post.

## Change (single file, isolated)
`src/hooks/useOriginalVisitTracker.ts` — `onVisibilityChange` only.

Currently the Threads branch of `onVisibilityChange` returns early:
```
// Threads is intentionally excluded here ...
if (trackPlayableInteraction && !isXPost()) return;
```

Update that branch to also allow Threads through the existing X-style fallback:
- If `trackPlayableInteraction` and `!isXPost() && !isThreadsPost()` → return (unchanged for YouTube/TikTok/IG/FB/LinkedIn/Pinterest/Spotify).
- Otherwise fall through to the existing `fireOriginal()` gated by:
  - `now - recentPointerRef.current < 3000` OR
  - `now - lastIframeInteractionRef.current < 10000`
- `firedRef` (already in place) guarantees max one `original_visit` per post per mount; `trackOriginalVisit` upserts on `(post_id, user_id, device_hash)` for cross-session dedup.

Everything else — the first-tap overlay, `firePlay`, `playFiredRef`, `threadsPlaySessionFired`, `image_view` path, `onPointerDown`, `onClick`, `onWindowBlur`, X behavior — is left byte-for-byte identical.

## Accepted trade-off
If a single tap happens to be both "Play" and "open original" (indistinguishable inside a cross-origin iframe), both events fire: +1 Play and +1 Visit. This matches the spec's per-event counting and cannot be avoided without cooperation from the Threads iframe.

## Verification
1. Tap Play on a Threads video, keep watching in-app → Play +1, Visit +0.
2. Tap the post header/username to open original in the Threads app/site → Visit +1 (Play may also +1 if the same tap registered on the overlay first; that is the accepted trade-off).
3. Tap platform icon in the header → Visit +1 via existing `markOriginalVisit`, no double count (`firedRef`/DB unique key).
4. Repeat taps → no additional Visit for the same post.
