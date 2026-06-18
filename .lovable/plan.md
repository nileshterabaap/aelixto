## Goal

When a post's source (Instagram, TikTok, YouTube, Facebook, Threads, X, Pinterest, Reddit, LinkedIn, etc.) is deleted or made private — so the embed renders a "link broken / post removed" fallback — automatically delete that post from Aelixto and send the original poster a notification with the thumbnail preview on the right side (matching existing notification styling).

## Why this can't be done in the browser

The embed iframes (instagram.com, youtube.com, …) are cross-origin, so we cannot read their DOM to detect "Sorry, this post isn't available" messages from the client. Any client-side guess would produce false positives (slow networks, ad-blockers, transient failures) and wrongly delete real posts.

The reliable signal is **server-side**: re-resolve each post's source URL via the official oEmbed / metadata endpoints. A consistent 404 / "not found" response means the source post is gone.

## Approach

### 1. New edge function: `validate-post-source`
For a given `postId`, fetch the canonical validation endpoint for its platform:

- instagram → `graph.facebook.com/v18.0/instagram_oembed` (existing META token) — 404 / `error.code 24` = removed
- facebook → `graph.facebook.com/v18.0/oembed_post` — same
- youtube → `youtube.com/oembed?url=…` — 404 / 401 = removed/private
- tiktok → `tiktok.com/oembed?url=…` — 404
- threads / x / linkedin / pinterest / reddit → HEAD request to the post URL; treat HTTP 404 / 410 as removed. Reddit also: `…/.json` returning `{}` or "removed" flag
- spotify / articles → skip (Spotify items rarely 404; articles handled by existing unfurl)

Return `{ status: "ok" | "removed" | "unknown" }`. Only `removed` triggers deletion. `unknown` (timeouts, rate-limits, 5xx) never deletes.

### 2. Confirmation gate (false-positive protection)
A post is only deleted when it returns `removed` on **two consecutive checks at least 6 hours apart**. We add a `posts.broken_check_count` int + `posts.broken_first_seen_at` timestamp. First removal hit just records; second hit deletes.

### 3. New edge function: `sweep-broken-posts` (cron)
Runs hourly via pg_cron. Selects ~100 posts ordered by `last_validated_at` ascending (oldest first), calls `validate-post-source` for each, updates counters, and when threshold is hit:
- captures the post's `thumbnail_url`, `platform`, `caption`/`title`, `media_url`
- inserts a row into `notifications` with `type = 'post_removed'`, `actor_user_id = null`, `target_user_id = post.user_id`, payload `{ thumbnail_url, platform, original_url, caption }`
- deletes the post (cascade removes likes/reposts/comments/saves as already configured)
- triggers existing push-notification pipeline

### 4. Notification UI
Existing `NotificationItem` already renders a right-side thumbnail when payload has `thumbnail_url`. Add a new branch for `type === 'post_removed'`:

> "Your <Instagram> post was removed because the original was deleted or made private." — with the platform logo + cached thumbnail on the right exactly like engagement notifications.

Tappable: opens a small sheet explaining why, no destination link.

### 5. Manual trigger on viewer
When `HydratedEmbed` mounts an Instagram/Facebook/Threads embed and the **`RawEmbedRenderer` onError** fires (which we already track via `rawEmbedFailed`), fire a one-shot `validate-post-source` call for that postId. This shortcuts the cron for posts the author is actively looking at, but still goes through the same 2-strike gate — no immediate deletion.

## Files

New:
- `supabase/functions/validate-post-source/index.ts`
- `supabase/functions/sweep-broken-posts/index.ts`
- migration: add `broken_check_count`, `broken_first_seen_at`, `last_validated_at` to `posts`; add `post_removed` to notification type enum; schedule hourly cron for `sweep-broken-posts`
- `src/components/notifications/PostRemovedNotification.tsx`

Edited:
- `src/components/notifications/NotificationItem.tsx` — route `post_removed` to new component
- `src/components/HydratedEmbed.tsx` — on `handleRawEmbedError`, call `validate-post-source` once per session per postId

## Out of scope / safeguards

- No client-side "guess" deletion — only server validation deletes.
- Posts from platforms we cannot reliably probe (Spotify, generic articles) are never auto-deleted.
- Transient failures (5xx, network, rate-limit) are recorded as `unknown` and do not advance the strike counter.
- Author can still manually delete; nothing changes for healthy posts.

Approve and I'll implement.