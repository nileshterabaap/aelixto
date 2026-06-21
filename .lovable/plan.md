## Continuing rebuild — Items 3–6

Items 1 & 2 verified. Proceeding with the remaining Keeps, one at a time, smallest first.

### Item 3 — Reddit thumbnail filtering (next)

**Client (`src/lib/getPostThumb.ts`)**
- In `isMisleadingThumbnail`, for `platform === 'reddit'` reject URLs whose lowercase form contains any of: `redditstatic.com`, `/snoo`, `snoo.png`, `snoo-`, `default-avatar`, `share.redd.it/preview/post`, `/brand`, `/icon`, `favicon`.
- Result: falls through to `TextCardThumbnail` instead of showing the Reddit alien logo.

**Server (`supabase/functions/fetch-post-preview/index.ts`)**
- Before writing a Reddit `thumbnail_url` / `preview_image_url`, run the same reject list and drop the field if it matches, so new posts don't store junk.

**One-time data cleanup (via insert tool)**
```sql
UPDATE public.posts
SET thumbnail_url = NULL
WHERE platform = 'reddit'
  AND thumbnail_url ~* '(redditstatic\.com|/snoo|default-avatar|share\.redd\.it/preview/post|/brand|/icon|favicon)';

UPDATE public.posts
SET preview_image_url = NULL
WHERE platform = 'reddit'
  AND preview_image_url ~* '(redditstatic\.com|/snoo|default-avatar|share\.redd\.it/preview/post|/brand|/icon|favicon)';
```

You verify in preview → I move to Item 4.

### Item 4 — Reddit preview-only mode at create time
- `fetch-post-preview/index.ts`: accept `previewOnly: boolean`; when true (or `postId` missing) skip DB write, return payload only.
- `CreatePostDialog.tsx`: for Reddit URLs swap `fetch-og` → `fetch-post-preview` with `previewOnly: true`.

### Item 5 — Follow polish (Follow Back / Asked / Alright / Sorry)
- `useFollow.ts` exposes `followsMe`, `isRequested`.
- Migration: update `search_profiles` RPC to return `is_requested`, `follows_me`.
- `UserProfile.tsx` + `SearchResultItem.tsx`: render Follow Back / Asked labels.
- `Notifications.tsx`: follow_request rows show **Alright** (approve) / **Sorry** (silently delete).

### Item 6 — Aelix Score info popup on Edit Profile
- `EditProfile.tsx`: small `i` button next to "Aelix Score" label. Plain `useState` + `setTimeout` (no Radix Tooltip), 5s auto-dismiss, tap-again cancels timer. Body: view (+1), play (+1), visit (+1).

### After all 6 verified
I'll ask about **U1** (per-event scoring) before touching it.

Probability of success: ~90% per item.

Approve and I'll start with Item 3.
