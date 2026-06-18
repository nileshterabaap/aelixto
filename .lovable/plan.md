## Goal
Rebuild pull-to-refresh from scratch so Home refresh does exactly this:

1. User pulls down from the very top of Home.
2. Posts that have truly been seen are committed as seen first.
3. The feed fetches the next unseen posts from the backend.
4. If none are left, show “You’re all caught up”.
5. No old spinner/gesture system, no hidden competing refresh paths.

## Plan

### 1. Keep refresh scoped to Home only
- Re-add pull-to-refresh only on `src/pages/Index.tsx`.
- Do not re-add it to Messages, Saved, Discover, Notifications, or Profile.
- This avoids cross-page gesture conflicts and keeps the rebuild focused on the feed problem.

### 2. Build a brand-new pull gesture component
- Create a new lightweight Home-only component, e.g. `HomePullRefresh`.
- Use one simple state machine:

```text
idle -> pulling -> ready -> refreshing -> idle
```

- Trigger only when:
  - page scroll is at top,
  - touch starts near the page content,
  - movement is downward,
  - horizontal swipe is not happening.
- Prevent it from fighting the existing left/right `SwipeableView` navigation.
- The spinner/indicator will be newly implemented, not reused from the deleted component.

### 3. Rebuild seen tracking as an explicit flush contract
- Update `useMarkPostSeen` to expose a single method like `flushSeenNow()`.
- `flushSeenNow()` will:
  - take the posts that passed the 50% visible / 1.5s rule,
  - write them to `post_seen`,
  - wait for that write to complete,
  - restore pending IDs if the write fails.
- This removes the race where refresh fetches before seen posts are actually stored.

### 4. Make refresh deterministic in `useFollowingFeed`
- Simplify refresh so it does one thing:
  - call the feed RPC after seen posts are flushed,
  - replace the current first page with returned unseen posts,
  - clear stale pagination state,
  - set empty state only after the fresh response returns empty.
- Avoid cache invalidation as the main mechanism.
- Avoid fallback retries that can mask the real refresh result.

### 5. Keep backend function simple unless frontend flush is not enough
- First use the existing backend feed RPC path already present.
- If implementation shows a remaining race, add one new backend RPC that atomically:
  - inserts seen post IDs,
  - returns the next unseen posts in the same transaction.
- Any migration will include execute grants and will not touch unrelated tables.

### 6. Validate with real browser behavior
- Test on the mobile viewport currently used in preview.
- Verify:
  - pull gesture triggers only at top,
  - spinner/indicator animates while refreshing,
  - seen posts do not come back after refresh,
  - unseen posts appear before “You’re all caught up”,
  - bottom navigation away/back is no longer required to see the refreshed result.

## Files expected to change
- `src/pages/Index.tsx`
- `src/hooks/useMarkPostSeen.ts`
- `src/hooks/useFollowingFeed.ts`
- new Home-only pull refresh component
- optional backend migration only if needed for atomic refresh