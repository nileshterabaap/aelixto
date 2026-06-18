## Deep checkout result

I found two concrete issues that can explain exactly what you’re seeing:

1. **Spinner snaps back / refresh feels unreliable**
   - `PullToRefresh` attaches touch listeners only after `containerRef.current` exists, but then listens on `window` while the referenced wrapper is not the real scroll container.
   - The app scrolls on `window`, not inside the pull wrapper, so the component is mixing container scroll checks with page scroll checks.
   - This can make the gesture fragile on the Home empty/caught-up screen and with keep-alive/display changes.

2. **Refresh may not load posts even if the spinner triggers**
   - `useMarkPostSeen` has `visibleRef`, but `takePendingSeenPostIds()` only sends `pending` + `inFlight` posts to the refresh RPC.
   - So the post currently on screen, or posts visible for less than the dwell/flush timing, may not be sent as “seen” during pull refresh.
   - That means the backend can return the same visible posts again or keep the feed looking unchanged.

Backend health/log check:
- Hosted backend is healthy.
- No recent backend errors for `refresh_following_feed`, `get_following_feed`, or `post_seen`.
- The refresh RPC itself correctly inserts passed seen IDs, then returns the refreshed following feed.

## Plan

1. **Make pull-to-refresh own the gesture reliably**
   - In `src/components/PullToRefresh.tsx`, remove dependency on the wrapper as a scroll container.
   - Use `window/document.scrollingElement` as the single source of truth for “at top”.
   - Attach touch listeners unconditionally while the component is mounted.
   - Keep the existing horizontal-swipe guard so `SwipeableView` does not get broken.

2. **Prevent instant snap-back from browser/scroll conflicts**
   - Once a downward pull is confirmed, prevent default consistently while pulling.
   - Keep the spinner resting for the existing minimum refresh duration.
   - Do not change feed thresholds/timing unless needed.

3. **Fix the refresh data path**
   - In `src/hooks/useMarkPostSeen.ts`, include `visibleRef.current` in `takePendingSeenPostIds()` along with pending/in-flight IDs.
   - Clear those visible IDs after taking them so the refresh RPC can mark them seen immediately.
   - This makes pull refresh capable of moving past posts the user is currently looking at, not just posts already batch-flushed.

4. **Remove temporary debug noise**
   - Remove `[PTR-DEBUG]` console logs from `Index.tsx` and `useFollowingFeed.ts` after the fix so the app stays clean.

5. **Verify**
   - Check Home caught-up state: spinner should follow the finger, hold briefly, then return smoothly.
   - Check feed state with visible posts: pull refresh should send visible post IDs to the backend refresh RPC.
   - Confirm Saved/Messages/Profile pull behavior is not regressed.