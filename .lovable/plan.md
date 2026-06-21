## Plan to fix Home feed pull-to-refresh

**Success probability: 86%.**

### What is happening
- Home is kept mounted with `display:none`, so tapping Search/Profile and coming back does **not** rebuild the Home page.
- The difference is that navigation makes the Home feed become visible/active again, while pull-to-refresh currently only asks React Query to refetch the existing infinite query.
- The old dedicated refresh path (`refresh_following_feed_v2`) was removed, so pull-to-refresh no longer has a refresh-specific backend path that can prioritize posts newer than the current feed and handle seen-post timing safely.
- `useRealtimeSync` also invalidates `following-count` and other feed-related keys, but not the actual `['following-feed', userId]` query for new posts, so refresh can stay on a caught-up cache unless a later visibility/navigation event shakes it loose.

### Implementation
1. **Restore a dedicated backend refresh function**
   - Re-create `refresh_following_feed_v2(limit_count, seen_post_ids, since_time)`.
   - It will:
     - accept posts currently visible/pending-seen from the client;
     - prioritize posts newer than the current top feed timestamp;
     - then fall back to the normal following feed;
     - keep execute access limited to signed-in users/backend service.

2. **Add a real refresh fetcher in `useFollowingFeed`**
   - Export reusable mapping/fetch logic.
   - Add a refresh helper that calls the restored refresh function with:
     - pending/visible post IDs;
     - the current newest feed timestamp.
   - Return rows in the same shape as the current infinite feed.

3. **Make `handleRefresh` replace the first feed page directly**
   - Instead of only invalidating/refetching and hoping observers update, explicitly fetch the refresh result and write it into the active `['following-feed', userId]` infinite-query cache.
   - Preserve later pages only if appropriate; otherwise reset to a clean first page so new posts render immediately.
   - Continue restoring pending seen IDs after the refresh request so seen tracking remains accurate.

4. **Fix realtime feed invalidation**
   - When posts/reposts/follows change, invalidate the actual signed-in feed key (`['following-feed', userId]`) as well as the related counters.
   - This keeps the feed cache consistent outside pull-to-refresh too.

5. **Validate the mechanism**
   - Use a read-only database check to confirm the function exists after migration.
   - Verify the source path now calls the refresh RPC and writes directly to the feed cache, matching the behavior users observe after leaving and returning Home.