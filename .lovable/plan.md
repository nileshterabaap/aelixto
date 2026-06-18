## Diagnosis

Yes — the screenshots strongly suggest the refresh is starting, then the feed enters an empty intermediate state. The most likely cause is the current refresh approach replacing the active feed query with a brand-new `refreshEpoch` cache key. During that handoff, `followingPosts` becomes empty, classifier queries may still be loading/refetching, and the UI can render a blank spacer instead of posts or “You're all caught up”.

There is also a second issue: the current refresh awaits `prefetchInfiniteQuery()` before switching the hook to the new query key. If that prefetch returns an empty/old result, fails silently, or races with `post_seen` flushing, the visible feed can be cleared even though navigating away/back later triggers a fresh active fetch that finally shows the posts.

## Plan

1. **Stop swapping feed cache keys on refresh**
   - Remove the `refreshEpoch` query-key approach from `useFollowingFeed`.
   - Keep one stable query key: `['following-feed', userId]`.
   - This prevents the visible feed from losing its active data during refresh.

2. **Implement refresh as an atomic first-page replacement**
   - Add an internal `refreshing` state in `useFollowingFeed`.
   - On pull-to-refresh:
     - cancel active feed requests,
     - fetch the first page directly from `get_following_feed_v2` with `cursor_key: null`,
     - replace the existing infinite-query data with exactly one fresh first page,
     - keep the previous feed visible if the refresh request errors.
   - This means refresh ends in one of two valid states only: fresh posts or a real empty/caught-up result.

3. **Prevent the blank empty-state branch**
   - In `Index.tsx`, remove the `<div className="py-16" />` branch that creates a blank screen when the feed is empty but `reachedEnd` is not yet true.
   - While refresh/classifier queries are settling, show skeletons or keep the previous posts instead.
   - If the backend confirms no unseen posts, show “You're all caught up”.

4. **Refetch helper queries without blocking the feed refresh**
   - Do not wait for `following-count` and `following-has-posts` before refreshing the feed.
   - Trigger those as background invalidations/refetches after the feed refresh starts/finishes.
   - This avoids a helper-query delay making the main feed look blank.

5. **Make bottom-nav Home refresh use the same path**
   - The Home button currently dispatches a refresh event but no page code listens to it, then it calls `refetchQueries()` directly.
   - Add a listener in `Index.tsx` so Home tap refresh uses the same safe `handleRefresh()` logic as pull-to-refresh.
   - Remove or ignore the separate direct refetch path to avoid inconsistent behavior.

6. **Keep the database function unchanged unless signal proves otherwise**
   - The current symptoms are mainly client-side state/caching: posts appear after navigating away/back, meaning the backend can return them.
   - I will not add another feed SQL migration unless runtime/network evidence shows the RPC itself is returning wrong rows.

## Validation

- Verify refresh no longer produces the blank spacer state.
- Verify pull-to-refresh always leaves visible posts in place until fresh data is ready.
- Verify an empty refresh ends with “You're all caught up”, not blank.
- Check console/network for feed RPC errors after the change.