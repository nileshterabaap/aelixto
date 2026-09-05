## Goal

Match Instagram behavior for X and Threads: tapping anywhere on the embedded post body must only view/play the media. The header platform icon becomes the sole way to open the original post and the sole trigger for `original_visit`.

## Current behavior (why body taps navigate today)

- X: the Twitter SDK inflates a `<blockquote>` whose author/timestamp/text nodes are real `<a target="_blank">` anchors, and when it upgrades to a same-domain iframe the whole iframe surface links to `x.com`. Anchor clicks currently also fire `original_visit` via the tracker's `onClick` handler.
- Threads: rendered as a cross-origin iframe where the entire iframe body deep-links to `threads.net`. A one-shot capture overlay currently fires `video_play` on the first tap and then removes itself, so any following tap navigates to Threads.

## Changes (frontend only)

### 1. `src/hooks/useOriginalVisitTracker.ts`
- In `onClick`, when `trackPlayableInteraction === true` AND the post is X or Threads, do NOT call `fireOriginal()` for anchor clicks inside the embed. Anchor-based visit inference stays enabled only for non-playable article/link-card embeds.
- Keep the existing "iframe tap = Play only" logic. No new `original_visit` inference from body taps for X or Threads under any code path.
- Extend `attachThreadsPlayCapture` so its overlay is **persistent** for both Threads and X iframes:
  - After the first body interaction fires `video_play`, keep the overlay mounted (do not remove, do not switch `pointerEvents` to none). Subsequent body taps are swallowed silently — no navigation, no duplicate Play.
  - Reuse the existing `ResizeObserver` + `syncOverlay` so the overlay tracks iframe geometry.
  - Add a sibling helper `attachXPlayCapture` (or generalize the current one) that matches `iframe[src*="twitter.com"], iframe[src*="x.com"], iframe[src*="platform.twitter.com"]` and behaves identically.

### 2. `src/components/embeds/TwitterEmbed.tsx`
- After the Twitter widget hydrates the blockquote, add a transparent capture layer that sits above the rendered tweet card (same pattern as the Threads overlay) so anchor clicks inside the SDK-rendered blockquote cannot open `x.com`.
- First tap on the layer calls `trackView({ postId, eventType: 'video_play' })` via a callback (mirrors the tracker's `firePlay`); subsequent taps are absorbed. Video posts still play because the native player exposes its own controls above the overlay only when the SDK renders an inline player; when it doesn't, the tweet is view-only, which matches the requested "view/play only" spec.
- Container must remain `position: relative` and overlay `pointer-events: auto; background: transparent; z-index` above the widget iframe.

### 3. Header platform icon (already correct — verify only)
- `src/components/HydratedFeedPost.tsx` header icon `onClick` continues to call `markOriginalVisit(post.id)` then `openExternalUrl(mediaUrl)`. No change needed; this remains the single sanctioned Visit trigger for every platform, X and Threads included.

### 4. Stability guard
- After the edits land, run `npm run stability:approve` so the new baselines for `useOriginalVisitTracker.ts` (protected in an earlier turn) and any newly locked file are stored.

## Explicit non-goals

- No changes to Instagram, Facebook, YouTube, TikTok, LinkedIn, Pinterest, Spotify, Reddit, Quora, or article/link-card tracking.
- No backend / edge-function / RLS changes. `record-view` burst-guard and score logic stay as they are.
- The Play event model is unchanged (still 1 per post, deduped by `threadsVideoPlayFiredPosts` for Threads and by `playFiredRef` for X).

## Success criteria

- Tapping anywhere on an X post body in the feed or profile grid: no navigation to `x.com`, `video_play` recorded exactly once, `original_visit` = 0.
- Tapping anywhere on a Threads post body: no navigation to `threads.net`, `video_play` recorded exactly once, `original_visit` = 0.
- Tapping the X or Threads platform icon in the post header: opens the original in a new tab and records `original_visit` exactly once.
- Instagram behavior unchanged.

Success probability: **90%** (the residual 10% is X's SDK occasionally repainting the blockquote after our overlay mounts; the `MutationObserver` in the tracker already reattaches iframe listeners, and the overlay's `ResizeObserver` handles geometry, so this is well covered).