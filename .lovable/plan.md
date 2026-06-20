**Success probability: 86%**

## Investigation findings
- The skeleton now triggers, so the gesture/UI layer is no longer the main blocker.
- The client still refreshes with `get_following_feed_v2`, which filters out posts already in `post_seen`.
- The app has a newer backend function, `refresh_following_feed_v2(seen_post_ids, since_time)`, designed specifically for this exact refresh case, but the client is not using it.
- `Index.tsx` calls `takePendingSeenPostIds()` and then discards the returned IDs, so visible/current posts are not being passed into the refresh RPC.
- Likely result: refresh clears the visible list, the normal unseen-feed RPC returns zero rows for a user who has already seen everything, then the UI exits skeleton into the “caught up”/empty state instead of posts.

## Plan
1. **Use the dedicated refresh RPC in `useFollowingFeed`**
   - Add a `refreshFeedPage(seenPostIds, sinceTime)` path that calls `refresh_following_feed_v2` instead of `get_following_feed_v2`.
   - Keep normal initial load and pagination on `get_following_feed_v2`.

2. **Pass the current refresh context from `Index.tsx`**
   - Capture `const seenPostIds = takePendingSeenPostIds()` instead of discarding it.
   - Capture the current top feed sort time from `allPosts[0]` before the skeleton replaces the feed.
   - Call `refreshFollowingFeed({ seenPostIds, sinceTime })`.

3. **Do not blank the feed permanently when refresh returns no rows**
   - During refresh, skeletons can replace the visible UI.
   - If the refresh RPC returns an empty page but the app already had posts, restore/keep the previous posts after skeleton ends instead of leaving the user with no posts.
   - Only show “caught up” if there were truly no posts available or the feed is intentionally empty.

4. **Make rapid pulls safe**
   - Preserve the existing request-id guard.
   - Ensure an older refresh response cannot overwrite a newer refresh response or clear the feed.

5. **Verify the actual path**
   - Confirm the client calls `refresh_following_feed_v2` on pull-to-refresh.
   - Confirm the DOM sequence is: existing posts → skeletons → posts again.
   - Confirm no console/network errors appear during the refresh.

## Files expected to change
- `src/hooks/useFollowingFeed.ts`
- `src/pages/Index.tsx`