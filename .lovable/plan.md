Plan to fix the current refresh regression

1. Reproduce the exact failing path first
   - Use the live preview in a mobile viewport.
   - Capture: initial rendered post count, pull-to-refresh spinner duration, feed RPC/network timing, final rendered post count, and screenshot after refresh.
   - Also capture the navigation-away/back-to-home path so we can compare what succeeds there.

2. Fix why the spinner returns immediately
   - The current refresh handler removes the active `following-feed` query and then calls `refetchQueries` on that same exact active query key.
   - Once removed, there may be no active query left for `refetchQueries` to await, so `onRefresh()` resolves immediately and `PullToRefresh` stops spinning.
   - Replace that with a refresh path that keeps the active query observable and awaits the actual feed fetch completion.

3. Make refresh render posts deterministically
   - Expose a real `refetch`/`refresh` function from `useFollowingFeed` instead of driving refresh indirectly from `Index.tsx` via cache removal.
   - In `handleRefresh`, await `flushNow()`, then await the feed refresh function, then refresh only the lightweight classifier queries (`following-count`, `following-has-posts`) without blocking the spinner if they are not needed for visible posts.
   - Do not hard reload the page and do not remove the active feed query during refresh.

4. Keep existing navigation behavior unchanged
   - Leave keep-alive navigation intact because that is currently the working path.
   - Only change pull-to-refresh/feed-query coordination.

5. Verify before reporting success
   - Re-run the same browser test after the change.
   - Confirm the spinner remains visible while the feed request is in flight.
   - Confirm refresh ends with rendered posts or the correct caught-up state, not a premature blank/empty render.
   - Confirm tapping another navigation tab and returning Home still shows posts.

Success probability: 86%.