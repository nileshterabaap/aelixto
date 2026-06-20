## What I found

- You were right: the previous “rollback” did not produce a visible pending change now; the working tree is clean.
- The real pre-Jun-12 feed baseline appears to be commit `9473f70`.
- Current feed files still differ heavily from that baseline, especially:
  - `src/hooks/useFollowingFeed.ts`
  - `src/pages/Index.tsx`
  - `src/components/PullToRefresh.tsx`
  - `src/components/PostSkeleton.tsx`
  - feed-related backend migrations/functions
- The earlier rollback restored a newer/manual implementation, not the exact pre-Jun-12 behavior.

## Goal

Restore only the refresh / “You’re all caught up” / feed-serving behavior to the state just before Jun 12 16:16, while keeping unrelated work after that date intact.

## Implementation plan

1. **Use `9473f70` as the verified target baseline**
   - Treat this as the “before the bad prompt” source for feed refresh/caught-up behavior.
   - Do not do a full project revert.

2. **Surgically restore frontend behavior**
   - In `useFollowingFeed.ts`, restore the pre-Jun-12 query-driven feed behavior:
     - TanStack infinite query feed loading
     - no custom `refresh()` state machine
     - no manual page state replacement
     - no post-refresh fallback-to-empty behavior
   - In `Index.tsx`, restore the pre-Jun-12 refresh handler:
     - flush seen-post tracking
     - clear/invalidate feed-related queries
     - reload after refresh, matching the old behavior
   - Restore pre-Jun-12 caught-up display rules:
     - “You’re all caught up” appears only when the feed-serving logic says the user has actually exhausted available unseen posts
     - no skeleton flash loop from refresh state
   - Keep unrelated later UI/content improvements where they do not affect refresh/feed-serving logic.

3. **Restore PullToRefresh behavior only if needed**
   - Compare current `PullToRefresh.tsx` against `9473f70`.
   - Only revert pieces that affect the refresh/caught-up flow.
   - Preserve unrelated gesture improvements unless they are part of the broken loop.

4. **Fix backend function state append-only**
   - Do not delete old migrations.
   - Add one new migration that redefines active feed RPC behavior to the pre-Jun-12 version.
   - Ensure `get_following_feed_v2` matches the old serving behavior.
   - Remove/neutralize `refresh_following_feed_v2` as an active dependency if the restored frontend no longer uses it.
   - Include required function grants.

5. **Verification**
   - Confirm diff is limited to feed-refresh/caught-up/serving scope.
   - Run a targeted feed behavior check:
     - initial load does not flash wrong empty state
     - refresh from caught-up does not skeleton-loop back incorrectly
     - feed content renders when eligible posts exist
     - caught-up appears only at real end state

## Risk

**Success probability: 89%**

The remaining risk is that some same-file changes after Jun 12 are unrelated and should be preserved, so this must be a surgical patch rather than wholesale file replacement.