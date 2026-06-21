## Restore pull-to-refresh + "caught up" exactly to the pre‑12 Jun 16:16 behavior

### Why the current version behaves differently
In the previous "rollback" I kept the new RPC/cache‑swap mechanics and only renamed/simplified them. The real pre‑16:16 behavior used a completely different mechanism for pull‑to‑refresh:

- Old `useFollowingFeed.ts` had **no `refresh()` function at all**. It was a plain `useInfiniteQuery` with `staleTime: 2min`, `refetchOnMount: true`, and also exposed `reachedEnd` (true only when the server returns 0 rows).
- Old `Index.tsx` `handleRefresh`:
  1. `await flushNow()` — push pending seen marks to DB,
  2. cancel + **remove** + invalidate `following-feed`, `following-count`, `following-has-posts`,
  3. wait 150ms,
  4. **`window.location.reload()`** — full hard reload of the page.
- "Caught up" message only showed when `followingHasAnyPosts && reachedEnd` (i.e. confirmed end of feed), with an intermediate `<div className="py-16" />` placeholder when posts exist but `reachedEnd` is still false. The current code shows "caught up" the moment the first page is empty, which is why a friend's brand‑new post can read as "all caught up" until something else forces a refetch.

The full‑page reload was the mechanism that guaranteed a clean fetch every time. The current RPC/`setQueryData` path skips that reload and depends on cache shape — exactly why refresh sometimes shows "all caught up" while navigating away and back works.

### Changes

1. **`src/hooks/useFollowingFeed.ts` — revert to baseline**
   - Remove `refresh()`, `useQueryClient`, `useCallback`, `fetchRefreshPage`, `mapFeedRows` extraction, and the standalone `RefreshRpcArgs` type.
   - Restore the inline mapper inside `fetchFeedPage`.
   - Re‑add `reachedEnd` (true when any page has `posts.length === 0`) to the returned object and to `UseFollowingFeedResult`.
   - Drop `refresh` from the return type.

2. **`src/pages/Index.tsx` — revert to baseline refresh + caught‑up logic**
   - Import `flushNow` from `useMarkPostSeen` instead of `takePendingSeenPostIds` / `restorePendingSeenPostIds`.
   - Destructure `reachedEnd` from `useFollowingFeed`; drop `refresh`/`refreshFollowingFeed`.
   - Replace `handleRefresh` with the baseline version:
     ```ts
     try { await flushNow(); } catch {}
     await Promise.all([
       queryClient.cancelQueries({ queryKey: ['following-feed', user?.id] }),
       queryClient.cancelQueries({ queryKey: ['following-count', user?.id] }),
       queryClient.cancelQueries({ queryKey: ['following-has-posts', user?.id] }),
     ]);
     queryClient.removeQueries({ queryKey: ['following-feed', user?.id] });
     queryClient.removeQueries({ queryKey: ['following-count', user?.id] });
     queryClient.removeQueries({ queryKey: ['following-has-posts', user?.id] });
     await Promise.all([
       queryClient.invalidateQueries({ queryKey: ['following-feed', user?.id] }),
       queryClient.invalidateQueries({ queryKey: ['following-count', user?.id] }),
       queryClient.invalidateQueries({ queryKey: ['following-has-posts', user?.id] }),
     ]);
     await new Promise((r) => setTimeout(r, 150));
     window.location.reload();
     await new Promise(() => {}); // keep spinner up until reload
     ```
   - Update the empty‑state branches to match baseline:
     - `followingCount === 0` → "Nothing here yet 👀"
     - `followingHasAnyPosts && reachedEnd` → "You're all caught up"
     - `followingHasAnyPosts && !reachedEnd` → empty `<div className="py-16" />` (don't show "caught up" prematurely)
     - else → "No posts yet"

3. **Database — drop the unused refresh RPC** (it didn't exist at baseline and isn't needed once the client uses `window.location.reload`)
   - New migration: `DROP FUNCTION IF EXISTS public.refresh_following_feed_v2(integer, uuid[], timestamptz);` (and any other signatures).

4. **Leave alone** (unrelated to refresh/caught‑up): `useRealtimeSync.ts`, `PullToRefresh.tsx`, `useMarkPostSeen.ts` (still exports `flushNow`), `get_following_feed_v2` (already matches baseline), `useFeedAnchorRestoration`, scroll/keep‑alive code.

### Verification
- Confirm via DB read that `refresh_following_feed_v2` is gone and `get_following_feed_v2` is unchanged.
- Grep to ensure no remaining references to `takePendingSeenPostIds` / `restorePendingSeenPostIds` / `refreshFollowingFeed`.
- After the user reproduces: a friend posts → pull‑to‑refresh on Home → page hard‑reloads → new post appears at top (same mechanism that worked before 12 Jun 16:16).

**Success probability: 94%** — this matches the verified baseline (`ccd62581`) byte‑for‑byte on the refresh path; the only intentional deviation is keeping `useRealtimeSync.ts` (added after baseline) untouched since it's unrelated to the user's complaint.
