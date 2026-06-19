## Plan: make pull-to-refresh actually behave like a real feed refresh

### What I found
- Pull-to-refresh is firing visually, but the backend refresh path still has brittle logic.
- The normal feed function and refresh function are not fully aligned in cursor/order behavior.
- The app currently replaces the feed instantly after refresh without a visible skeleton/loading state, which makes it feel like nothing happened even when the request runs.
- The current refresh flow overuses `post_seen` as both “I viewed this” and “advance the feed now”, which can hide/fill results in ways that feel broken.

### Fixes to implement
1. **Restore the real refresh loading experience**
   - When the user pulls to refresh, temporarily show the feed skeleton state again.
   - Keep the spinner, but also make the feed visibly enter a loading state like the older version the user misses.
   - Avoid empty flicker: skeleton only during active user refresh, not random background renders.

2. **Make refresh fetch the latest followed posts first**
   - Update `refresh_following_feed_v2` so its “new posts” query exactly matches the current feed eligibility rules.
   - Use the feed sort time consistently (`created_at` for original posts, repost time for reposts).
   - Return posts newer than the current top feed item even if they were already touched by seen tracking.

3. **Stop refresh from hiding the current feed too aggressively**
   - Keep marking visible/dwelled posts as seen for normal feed progression.
   - Do not let “all rendered post IDs” accidentally erase the user’s current page before the newer-post check is complete.
   - If no newer posts exist, the feed should still reload cleanly instead of looking dead.

4. **Align cursor format between normal feed and refresh**
   - Make the refresh fallback return the same cursor shape/order as `get_following_feed_v2`.
   - This prevents load-more and refresh from drifting into different ordering systems.

5. **Add focused diagnostics while fixing**
   - Add temporary-safe console/debug signals around refresh result counts and since-time boundaries only if needed.
   - Verify the request actually calls `refresh_following_feed_v2` and returns rows.
   - Remove noisy debug output before finalizing unless it is behind development-only checks.

### Verification
- Confirm a pull gesture triggers the refresh RPC.
- Confirm active refresh shows skeletons, then turns into posts.
- Confirm a newly created post from a followed user appears above the previous top post after refresh.
- Confirm the caught-up state still works when there are genuinely no unseen/newer posts.
- Confirm no database permission/RLS errors are introduced.