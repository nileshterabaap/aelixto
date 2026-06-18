## Why refresh is not bringing new posts

The current rebuild only sends `pendingSeenIds` to the refresh RPC. Those are posts that already passed the 50% visibility + 1.5s dwell timer and were added to `pendingRef`.

So refresh can still fail in these cases:

1. **The currently visible top post may not be pending yet**
   - If you pull before the 1.5s timer finishes, `takePendingSeenIds()` returns nothing.
   - The backend then thinks the visible/current posts are still unseen, so it returns the same posts again instead of newer unseen ones.

2. **Already-flushed seen posts are okay, but visible-not-yet-flushed posts are not included**
   - The refresh RPC atomically inserts only the IDs it receives.
   - It does not know which posts are currently on screen unless the client sends them.

3. **The pull gesture is UI-only; the feed replacement depends entirely on the seen list**
   - New posts only appear if the backend can exclude everything the user has already seen.
   - Right now the client is not giving it a complete “seen before refresh” list.

## Fix plan

1. **Keep the Home-only pull refresh component**
   - Do not re-add refresh to other pages.
   - Keep the gesture scoped to the Home feed.

2. **Change seen tracking to expose visible + pending IDs**
   - Replace/extend `takePendingSeenIds()` with a refresh-specific method like `takeRefreshSeenIds()`.
   - It will return:
     - posts already pending from the 1.5s rule
     - posts currently at least 50% visible
   - This makes pull refresh count the currently viewed post immediately, even if the timer has not fired yet.

3. **Deduplicate and restore safely**
   - Deduplicate IDs before sending to the backend RPC.
   - If refresh fails, restore only the IDs that came from pending state so the normal batch retry still works.

4. **Use the existing atomic refresh RPC**
   - Keep `refresh_following_feed_v1` as the single backend call.
   - It will insert those seen IDs and return the next unseen page in one transaction.

5. **Improve front-end refresh result handling**
   - When the RPC returns new posts, replace the first page with them.
   - When it returns empty, show “You’re all caught up” immediately.
   - Do not rely on cache invalidation or navigation away/back.

6. **Validate in browser**
   - Confirm pulling while a post is visible sends that post as seen.
   - Confirm the same post does not reappear after refresh.
   - Confirm new/unseen posts appear above “You’re all caught up.”