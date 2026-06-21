Yes — there are still essential differences left. The earlier restore fixed `useFollowingFeed.ts` and most of `Index.tsx`, but the exact 12 Jun 15:30 behavior also depends on mark-as-seen timing, the pull gesture component, realtime cache invalidation, prefetch cursor behavior, and the backend feed RPC.

## Plan

1. **Restore mark-as-seen behavior to 15:30**
   - Revert `src/hooks/useMarkPostSeen.ts` to the 15:30 logic:
     - `VISIBILITY_THRESHOLD = 0`
     - no 50% visibility requirement
     - no 1.5s dwell timer
     - mark a post as seen immediately when any part enters the viewport
     - return only `{ setObservedPostElement, flushNow }`
   - This is essential because current behavior waits longer before marking posts seen, so refresh/feed serving will not match that period.

2. **Restore pull-to-refresh gesture to 15:30**
   - Revert `src/components/PullToRefresh.tsx` to the 15:30 version:
     - threshold back to `60`
     - max pull back to `180`
     - content moves down with the pull
     - no `flushSync`, no `MIN_REFRESH_MS`, no `__pullActive` coordination
   - This is essential because the current gesture triggers differently and visually behaves differently.

3. **Restore swipe coordination around pull gestures**
   - Revert only the later pull-related changes in `src/components/SwipeableView.tsx`:
     - remove `window.__pullActive` checks
     - restore the old direction-lock threshold/bias
   - This keeps horizontal swipe behavior from changing the old pull-to-refresh feel.

4. **Remove realtime feed invalidation from the 15:30 path**
   - Remove `useRealtimeSync()` usage from `src/App.tsx`.
   - Optionally delete the now-unused `src/hooks/useRealtimeSync.ts` if it has no callers.
   - This is essential for exact 15:30 behavior because this hook did not exist then and it can background-refresh/reorder feed data independently of pull-to-refresh.

5. **Restore prefetch cursor rule exactly**
   - In `src/lib/prefetch.ts`, change the first-page prefetch cursor back to:
     ```ts
     nextCursor: mappedPosts.length === 20 ? mappedPosts[mappedPosts.length - 1].feed_cursor : undefined
     ```
   - This is small, but it was explicitly different from the requested snapshot.

6. **Restore backend feed RPC ranking/filter placement**
   - Add a migration that recreates `public.get_following_feed_v2(integer, text)` as it was at the 12 Jun 15:30 snapshot.
   - The key behavioral restore: filter `post_seen` inside the eligible-post selection before tiering/ranking, not after ranking.
   - Keep the same freshness-tiered/interleaved feed order from that snapshot.
   - Keep execute grants for authenticated users and service role as required.

7. **Verify the restore**
   - Confirm no source diffs remain against `785dca03` for the feed/refresh files except intentionally unrelated UI files.
   - Confirm the backend function text matches the 15:30 version.
   - Confirm pull-to-refresh performs the old hard reload path and feed serving uses the restored ranking/filter behavior.

## Not included

- No changes to unrelated UI/embed/profile files unless they directly affect feed refresh.
- No reintroduction of the later `refresh_following_feed_v2` path, because that was not part of the 15:30 behavior.

**Success probability: 94%.**