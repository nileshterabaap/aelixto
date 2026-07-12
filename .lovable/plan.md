Plan to fix Threads `video_play` only. Success probability: 86%.

1. Add very narrow instrumentation around only the Threads `video_play` path
   - Log/record these signals for a Threads post only: hook mounted, iframe found, iframe rect, pointer/touch coordinates, `window.blur`, delayed `activeElement`, `pointer-events` state, and whether `firePlay()` was reached.
   - Do not touch `original_visit`, `visibilitychange`, `trackOriginalVisit`, score display, or other platforms.

2. Fix the likely blocker: global iframe `pointer-events: none`
   - Current CSS disables all iframes when the feed is at scroll-top and during iframe scroll-freeze.
   - That can prevent the Threads iframe from receiving focus/blur, so the current blur-based path still misses the first interaction.
   - Change only the Threads playable detection to use a parent-side transparent first-tap capture overlay / coordinate hit-test that fires `video_play` once, then immediately removes itself so the second tap reaches the Threads player normally.

3. Keep it Threads-only and one-shot
   - Apply only to `iframe[src*="threads.net"], iframe[src*="threads.com"]` inside the post’s own embed container.
   - Use the existing `playFiredRef` plus a post-scoped session guard so it emits one `video_play` maximum per mounted post/user session.
   - Keep all non-Threads iframe, X, visibility, and original-visit paths unchanged.

4. Verify the signal
   - Confirm first tap on a Threads iframe reaches `firePlay()` exactly once.
   - Confirm repeated taps do not emit another `video_play`.
   - Confirm no `original_visit` code path was modified.