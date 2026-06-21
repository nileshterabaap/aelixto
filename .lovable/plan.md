## Rebuild plan — reapply Keep items from `mem://rebuild/from-june-12`

Working agreement (from the memory file): apply Keep items one at a time, smallest first; you verify in the live preview after each before I move on; do not touch anything on the Skip list (useFollowingFeed, PullToRefresh, useMarkPostSeen, Index refresh path, seen logic). After the 6 Keeps are in, I'll ask before touching U1 (per-event scoring).

Probability of success: ~90% per item individually.

### Order of work

**1. Compact Aelix score (10k threshold)**
- Create `src/lib/formatCount.ts` with `formatCount(n)`: `<10000 → full number`, `≥10000 → 12.3k`, `≥1e6 → 1.2M`, `≥1e9 → 1.2B`.
- Use it in `src/pages/UserProfile.tsx` where the Aelix score renders.

**2. Dark gray default profile cover**
- Add `--profile-cover: 0 0% 24%` + `.profile-cover-fallback { background: hsl(var(--profile-cover)); }` to `src/index.css`.
- Replace the current cover gradient/`bg-muted` and the matching skeleton class in `src/pages/UserProfile.tsx` with `profile-cover-fallback`.

**3. Reddit thumbnail filtering (client + server)**
- `src/lib/getPostThumb.ts`: when `platform === 'reddit'`, reject URLs matching `redditstatic.com`, `snoo`, `brand`, `icon`, `favicon`, `default-avatar`, `share.redd.it/preview/post` → fall back to text card.
- Mirror the same reject list in `supabase/functions/fetch-post-preview/index.ts` so future posts don't store junk thumbnails.
- One-time `UPDATE` (via insert tool) to null `thumbnail_url` / `preview_image_url` on existing rows containing `share.redd.it/preview/post`.

**4. Reddit preview-only mode at create time**
- `supabase/functions/fetch-post-preview/index.ts`: accept `previewOnly: boolean`; when true (or `postId` missing) skip the DB write and just return the preview payload.
- `src/components/CreatePostDialog.tsx`: for Reddit URLs, swap the `fetch-og` call for `fetch-post-preview` with `previewOnly: true` so the create-dialog preview matches what publishes.

**5. Follow system polish — Follow Back / Asked / Alright / Sorry**
- `src/hooks/useFollow.ts`: expose `followsMe` and `isRequested`.
- Update the search RPC `search_profiles` to return `is_requested` and `follows_me` (migration).
- Update buttons in `src/pages/UserProfile.tsx` and `src/components/SearchResultItem.tsx` to render **Follow Back** (target follows you, you don't follow back) and **Asked** (pending request to a private account).
- `src/pages/Notifications.tsx`: `follow_request` rows read `@username asked to Follow` with **Alright** (approve) and **Sorry** (silently delete the request).

**6. Aelix Score info popup on Edit Profile**
- `src/pages/EditProfile.tsx`: add a small `i` button next to the "Aelix Score" label. Plain `useState` + `setTimeout`, NOT Radix Tooltip. Auto-dismiss after 5s; tapping again cancels the timer. Body:
  > Aelix Score represents the total engagement earned by your shared posts.
  > • View a shared post (+1)
  > • Play shared content (+1)
  > • Visit the original source (+1)

### After all 6 are verified

I'll ask whether to attempt **U1 (per-event scoring: +1 view / +1 play / +1 original visit)** with a clean implementation, or leave scoring on the June 12 baseline.

### Out of scope (Skip list — staying on June 12 baseline)

`reachedEnd`, `has_unseen_following_feed_posts`, "Feed couldn't load" UI, `manualPages`, React Query removal in `useFollowingFeed`, `refresh_following_feed_v1`, `useRealtimeSync`, PullToRefresh rewrites, `SEEN_DWELL_MS`, `refetchOnMount: 'always'`, `window.location.reload()` in `handleRefresh`, duplicate-trigger removal.

Approve and I'll start with item 1.