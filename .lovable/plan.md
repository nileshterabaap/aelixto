## Plan: make pull-to-refresh visibly and reliably reload

1. **Add an explicit refresh-loading signal**
   - Track `isRefreshingFeed` in `Index.tsx` separately from `useFollowingFeed.loading`.
   - Set it to `true` immediately when pull-to-refresh starts.
   - Keep it true for a short minimum duration so even fast network responses show skeletons.
   - Use a refresh run id / guard so rapid repeated pulls cannot turn the skeleton off early.

2. **Show skeletons because refresh is active, not because feed happens to be empty**
   - Change `shouldShowSkeleton` so active refresh always renders `PostSkeleton`s.
   - This guarantees the old “skeleton turns into posts” behavior even when stale posts already exist or the hook resolves quickly.

3. **Make refresh fetch a fresh first page cleanly**
   - Keep the current simplified refresh path: flush pending seen markers, call `refreshFollowingFeed()`, invalidate following-count.
   - Ensure the skeleton remains on screen until that fresh request finishes, then render the newly fetched feed.

4. **Handle edge cases**
   - Rapid pulls while a refresh is in-flight should not start competing refreshes or hide skeletons prematurely.
   - Failed refresh should still exit skeleton state cleanly and show the current feed/empty state instead of getting stuck.

5. **Verify**
   - Confirm the code path makes `shouldShowSkeleton === true` immediately during refresh.
   - Confirm the skeleton state is not dependent on `allPosts.length === 0`.
   - Confirm the feed renders again after the refresh promise settles.