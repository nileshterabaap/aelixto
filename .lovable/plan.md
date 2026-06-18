I found the most likely real cause: the refresh boundary is using the wrong timestamp.

The feed is ordered by an internal feed sort time (`reposted_at` / `sort_time`), but the frontend currently sends `created_at` as the “newer than this” boundary. That means refresh can ask the backend the wrong question, especially for reposts and any feed item whose visible feed time differs from the original post creation time. Also, the new refresh RPC returns a cursor shape that does not match the current feed cursor format.

Plan:

1. Fix the feed data model in `useFollowingFeed`
   - Keep `reposted_at` from the backend instead of dropping it.
   - Expose a stable feed-sort timestamp for every item.
   - Keep original `created_at` for post metadata/display where needed.

2. Fix `Index.tsx` refresh boundary
   - Stop calculating the “top timestamp” from `post.created_at`.
   - Use the actual top feed item’s backend sort time (`reposted_at`, falling back to `created_at`).
   - Keep sending rendered IDs as seen, but only as the “advance past current feed” signal — not as the timestamp boundary.

3. Replace `refresh_following_feed_v2` with a stricter backend function
   - Match `get_following_feed_v2` eligibility rules exactly: followed users, own posts, hidden posts/users, repost rules.
   - Use the same freshness-tier/interleaving order as the feed.
   - For pull-to-refresh, return items whose feed sort time is newer than the current top feed item.
   - Return feed cursors in the same JSON shape as `get_following_feed_v2` (`tier`, `sort_time`, `rank`, `shuffle`, `id`), not the older `bucket` shape.
   - Continue falling back to normal unseen feed only when no newer item exists.

4. Verify the actual PTR call path
   - Use the live preview/network trace to confirm `refresh_following_feed_v2` fires when pulling.
   - Confirm the request includes a non-null boundary timestamp.
   - Confirm new rows returned by the backend become the first feed items.

Files expected to change after approval:
- `src/hooks/useFollowingFeed.ts`
- `src/pages/Index.tsx`
- New backend migration replacing `refresh_following_feed_v2`

No UI redesign, no spinner physics changes, no account-linking prompts.