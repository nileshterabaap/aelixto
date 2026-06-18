## Goal
Find out — with evidence, not guesses — why "You're all caught up" appears after a pull-to-refresh while posts are still in the database. No rewrites. No revert. Your 5–6 recent updates stay exactly as they are.

## What changes (temporary, removable in 30 seconds)

Only `console.log` statements. Zero behavior change.

### 1. `src/hooks/useFollowingFeed.ts` — inside `refresh()`
Add 3 logs:
- **Before the RPC call:** log how many `seenPostIds` are being sent.
- **After the RPC returns:** log how many posts came back and the `nextCursor`.
- **After `setPages([firstPage])`:** log what was just set.

### 2. `src/pages/Index.tsx` — inside `handleRefresh`
Add 1 log:
- Log the `seenPostIds` array length taken from `takePendingSeenPostIds()` right before calling `refreshFollowingFeed`.

### 3. `src/pages/Index.tsx` — at the empty-state branch
Add 1 log right where `followingEmpty` is evaluated for rendering:
- Log `{ followingEmpty, itemsLength: allPosts.length, hasMore, followingCount }`.

All logs prefixed with `[PTR-DEBUG]` so they're easy to find and strip out later.

## What you do

1. Open the app on your phone (or preview).
2. Open the browser console (or just pull-to-refresh — the logs will reach me through the console snapshot).
3. Pull to refresh **once** when the feed is showing posts.
4. Send me the next message — I'll automatically see the new console logs.

## What the logs will prove (one of these)

| Log pattern | Diagnosis | Fix |
|---|---|---|
| RPC returns 0 posts, then `setPages([])` runs | Server has no fresh unseen posts; we wipe the list | Keep old posts on empty response, show "no new posts" toast |
| RPC returns posts but `followingEmpty` still true | State/render race | Fix the `empty` derivation in the hook |
| `seenPostIds` is huge (sending every post ever seen) | RPC filtering everything out | Send only currently-visible seen IDs |
| RPC returns posts and they render fine | Bug is elsewhere (cache, hasMore) | Investigate `hasMore` / cache layer |

## After the fix

Once we have a working fix confirmed by you, I remove all 5 `[PTR-DEBUG]` logs in a single cleanup pass.

## Risk

None. Logs don't change behavior. If you hate them, one message and they're gone.
