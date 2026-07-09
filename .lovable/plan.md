## What I found

- **X:** the score only credits from the platform icon because that button directly calls `markOriginalVisit(post.id)`. The X embed itself is rendered inside Twitter's SDK iframe, and taps inside that cross-origin iframe do not reliably bubble to Aelixto's container listener. So normal post taps never reach the tracking hook.
- **Threads:** Threads is using a direct iframe. Like X, iframe taps can be swallowed before Aelixto sees them. Also, when Threads opens/hands off quickly, the regular async tracking request can be aborted before it reaches the backend.
- **Profile refresh:** the profile pull-to-refresh code already invalidates profile grid queries, but I’ll verify it’s invalidating the exact keys used by platform tabs/posts and tighten if needed.

## Plan

1. **Make X post taps count as original visits**
   - Keep the icon behavior unchanged.
   - Add a tiny transparent click-capture layer only for X embeds, positioned over the embed tap area.
   - On tap, call `markOriginalVisit(post.id)` first, then open the X URL through the existing external-url helper.
   - This matches what the icon already does, but works when tapping the post itself.

2. **Make Threads video taps count as plays**
   - Add a Threads-specific tap capture layer in the Threads iframe wrapper.
   - On tap, immediately send `video_play` using the navigation-safe beacon path, then let the user open/interact with the Threads post.
   - Keep it once-per-post on the frontend; backend dedupe remains the final guard.

3. **Fix the tracking hook bug that blocks beacon fallback**
   - Current code sets `playFiredRef = true` before the normal `video_play` request finishes, so the hidden/visibility beacon fallback often refuses to send.
   - Add a separate “pending play” flag so Threads can still send beacon if the page backgrounds before confirmation.

4. **Re-check profile refresh query keys**
   - Confirm `useUserPlatformPosts` / `useUserPlatformTabs` keys match `UserProfile` invalidation.
   - If there’s a mismatch, update only that invalidation path so new posts appear after refresh.

## Scope control

- No scoring-rule changes.
- No backend schema changes unless the frontend fix reveals the edge function rejects valid `video_play` / `original_visit` requests.
- No unrelated UI changes.

**Probability of success: 88%.**