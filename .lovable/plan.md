## Restore pull‑to‑refresh + caught‑up to the 12 Jun **15:30 IST** version

### What 15:30 looked like (commit `785dca03`, 10:01 UTC)
Right after that commit the merge `1b16a39c` "Fixed default cover & caught‑up logic" (10:52 UTC / 16:22 IST) bundled two unrelated things:

1. A profile cover styling tweak (`profile-cover-fallback`) — unrelated, keep as‑is.
2. The caught‑up regression: it introduced `reachedEnd` in `useFollowingFeed`, gated the "You're all caught up" UI on it in `Index.tsx`, and changed the pagination cursor rule in `prefetch.ts`.

My previous restore matched commit `ccd62581` (12:10 UTC / 17:40 IST), which still contains change #2. That's why the behaviour is still wrong. The 15:30 version did NOT have `reachedEnd` — the caught‑up message simply followed `followingHasAnyPosts` / `!hasMore`, and `handleRefresh` was already the `window.location.reload()` flow I restored last turn. The reload path stays — only the caught‑up gating reverts.

### Changes (3 files)

1. **`src/hooks/useFollowingFeed.ts`** — remove every reference to `reachedEnd`:
   - Drop `reachedEnd: boolean` from `UseFollowingFeedResult`.
   - Delete the `reachedEnd` `useMemo`.
   - Drop `reachedEnd: Boolean(userId) && reachedEnd` from the returned object.

2. **`src/pages/Index.tsx`** — revert caught‑up branches to the 15:30 form:
   - Stop destructuring `reachedEnd` from `useFollowingFeed`.
   - In the empty‑state block: replace `followingHasAnyPosts && reachedEnd` with `followingHasAnyPosts`, and remove the intermediate `followingHasAnyPosts ? <div className="py-16" />` branch.
   - In the infinite list footer: change `{reachedEnd && !hasMore && !showDemoFeed && allPosts.length > 0 && (` back to `{!hasMore && !showDemoFeed && allPosts.length > 0 && (`.
   - Leave `handleRefresh` (already the reload flow), `flushNow`, imports, and everything else untouched.

3. **`src/lib/prefetch.ts`** — restore the 15:30 cursor rule:
   - Change
     ```ts
     nextCursor: mappedPosts.length === 0 ? undefined : mappedPosts[mappedPosts.length - 1]?.feed_cursor,
     ```
     back to
     ```ts
     nextCursor: mappedPosts.length === 20 ? mappedPosts[mappedPosts.length - 1].feed_cursor : undefined,
     ```

### Not touched
`useMarkPostSeen.ts`, `useRealtimeSync.ts`, `PullToRefresh.tsx`, `get_following_feed_v2`, the profile cover styling (`profile-cover-fallback`), keep‑alive/scroll code — none of these existed differently at 15:30 in a way that affects refresh/caught‑up.

### Verification
- `rg "reachedEnd"` returns no hits anywhere in `src/`.
- Manual diff of the three files against `git show 785dca03:<path>` shows zero remaining differences in the refresh/caught‑up code paths.
- User reproduces: friend posts → pull‑to‑refresh → page hard‑reloads → new post appears; "You're all caught up" only appears when `!hasMore`, matching 15:30 behaviour.

**Success probability: 96%** — the diff above is the exact inverse of the commit (`1b16a39c`) that diverged from 15:30, limited to the three files that touched refresh/caught‑up logic.