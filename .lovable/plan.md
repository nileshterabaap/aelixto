## Problem

When a followed user posts something new and you pull-to-refresh, the feed shows "You're all caught up" instead of the new post. Navigating to another tab and back makes it appear. Two independent bugs combine to cause this.

### Bug 1 — Pending "seen" marks are flushed into the refresh response

`useMarkPostSeen` exposes `takePendingSeenPostIds` / `restorePendingSeenPostIds` precisely so refresh can drain pending seen-marks *before* hitting the DB, then put them back afterwards. `src/pages/Index.tsx` never calls them. Result: posts that were viewed in the last 3s get written to `post_seen` while the refresh RPC is in flight, the RPC filters them out, and if your followings haven't posted much else, the response is empty.

### Bug 2 — `get_following_feed_v2` filters seen posts inside `eligible_posts` CTE

The active version (migration `20260620095832`) filters `NOT EXISTS post_seen` inside the `eligible_posts` CTE, so `cluster_rank` is computed over a shrinking pool. This both:
- Returns 0 rows when most of the small follow-graph pool is already seen (even when a new unseen post exists, it can be ordered behind cursor invariants that no longer hold).
- Breaks `loadMore()` cursor pagination — ranks change between calls.

The June 12 baseline (`20260612105113`) had the correct shape: filter is in the **outer WHERE**, so `cluster_rank` is stable and new unseen posts always surface on refresh.

## Plan

### 1. New DB migration — restore outer-WHERE seen filter

Create `supabase/migrations/<ts>_restore_outer_seen_filter.sql` that re-creates `public.get_following_feed_v2(integer, text)` with the structure from the 12 Jun baseline:

- Build `candidate_posts` CTE from `posts` + `reposts` for followings (+ self) — **no `post_seen` filter here**.
- Compute `tier`, `shuffle_score`, then `cluster_rank` via `row_number()` on the full candidate pool — ranks are now stable across calls.
- In the final SELECT add `AND NOT EXISTS (SELECT 1 FROM post_seen ps WHERE ps.user_id = auth.uid() AND ps.post_id = r.id)` alongside the cursor predicate.
- Preserve current return signature, ORDER BY (`tier, cluster_rank, shuffle_score, id`), and `LIMIT limit_count`.
- Re-apply existing `GRANT EXECUTE ... TO authenticated, service_role` and keep `SECURITY DEFINER` / `search_path` exactly as in the current function.

No table changes, no other RPC touched.

### 2. Wire pending-seen coordination into refresh

In `src/pages/Index.tsx`:

- Destructure `takePendingSeenPostIds` and `restorePendingSeenPostIds` from `useMarkPostSeen`.
- In `handleRefresh`:
  1. `const drained = takePendingSeenPostIds();` (pauses the flush race).
  2. `await Promise.all([refreshFollowingFeed(), queryClient.invalidateQueries({ queryKey: ['following-count', user?.id] })]);`
  3. In `finally`, `restorePendingSeenPostIds(drained)` so those posts keep being tracked normally and will be flushed on the next interval.

No other behavior changes — pull-to-refresh, skeletons, empty-state copy, and the bottom "all caught up" stay as-is.

## Files

- `supabase/migrations/<new-timestamp>_restore_outer_seen_filter.sql` (new)
- `src/pages/Index.tsx` (edit `handleRefresh` + destructure)

## Out of scope

- No changes to `PullToRefresh`, `useFollowingFeed`, or `useMarkPostSeen` internals.
- No revert of any UI/feed-ordering work since 12 Jun — only the seen-filter placement is reverted.

## Verification

1. Have a followed account post a new item.
2. With Home open and feed already viewed, pull-to-refresh → new post must appear at top (not "all caught up").
3. Scroll to bottom → `loadMore()` returns additional pages until truly exhausted.
4. With nothing new posted and everything seen → bottom "You're all caught up" still renders correctly.

Success probability: 92%.