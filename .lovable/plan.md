## What is actually different

- Pull-to-refresh currently does a destructive cache clear and then `window.location.reload()`.
- Tapping another navigation button and returning does **not** reload the app. Home is kept alive with `display:none`, so it simply reveals the already-mounted feed state.
- The backend `post_seen` access is still suspicious: direct privilege checks pass, but `information_schema.role_table_grants` returned no grant rows. I will verify this with live browser/network tests instead of assuming.

## Plan

1. **Reproduce both paths in the browser**
   - Use the logged-in preview session.
   - Capture network calls, DOM post counts, route changes, and screenshots for:
     - initial Home load
     - pull-to-refresh
     - navigation away and back to Home
   - Confirm whether refresh returns zero rows from `get_following_feed_v2`, loses auth/session timing, or clears the render cache incorrectly.

2. **Add temporary local instrumentation only while testing**
   - Log feed RPC row counts, errors, query state, and refresh steps in the browser console.
   - Remove this instrumentation before finalizing.

3. **Fix the proven cause only**
   - If refresh is empty because it reloads before the query/session/cache lifecycle settles: replace hard reload with an in-app query reset/refetch flow and keep Home mounted.
   - If refresh is empty because `flushNow()` marks too many currently rendered posts as seen before fetching replacements: adjust refresh to fetch the next unseen feed without over-clearing visible posts.
   - If backend grants/RLS are still blocking seen writes or RPC reads in the real client path: add the missing migration and verify with authenticated browser requests.

4. **Verify before claiming success**
   - Re-run the same browser test.
   - Confirm pull-to-refresh ends with rendered feed posts, not only skeleton/empty state.
   - Confirm navigation away/back still works.
   - Confirm no relevant console or network errors.

## Likely fix direction

Most likely the refresh should stop using `window.location.reload()` and instead perform an awaited in-app `resetQueries/refetchQueries` for `['following-feed', user.id]`. The reload path is the key behavior navigation-back does not share.

Success probability: 88%