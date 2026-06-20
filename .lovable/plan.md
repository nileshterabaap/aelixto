## What's actually happening

### 1. "You're all caught up" right after refresh, then posts appear on tab switch

`handleRefresh` in `src/pages/Index.tsx` currently ends with `window.location.reload()`. After a full page reload:

- The feed query (`useFollowingFeed`) becomes enabled the moment `user?.id` is set by `useSession`.
- But the Supabase JS client rehydrates its access token asynchronously from `localStorage`. There is a short window where `user.id` is already in memory but the auth header has not yet been attached to the next HTTP request.
- The RPC `get_following_feed_v2` gates everything on `auth.uid()`. If the call lands in that window, `auth.uid()` is NULL → 0 eligible posts → `followingEmpty = true` → "You're all caught up".
- When you tap Search / Notifications / Profile and come back, `refetchOnMount: true` re-runs the query, this time with the auth header attached, and the friend's new post shows up.

So the reload itself is the bug. Refresh should not hard-reload the page — it should refetch in-place where the session is already alive.

### 2. LinkedIn still not rendering

Even after widening the iframe to 760px, the user reports it still doesn't render. We need to actually look at the live preview with Playwright on a known LinkedIn post URL, capture:

- whether `buildLinkedInEmbed` returns an iframe or null for that exact URL (URL pattern may not match — e.g. modern `/posts/...` slugs without `-activity-` / `-ugcPost-` / `-share-` infix).
- whether the iframe loads at all (network 200 vs blocked X-Frame).
- screenshot of the post card.

Only after we see that evidence can we land the right fix (URL pattern, fallback strategy, or both).

## Plan

### Step 1 — Fix refresh race (frontend only)

In `src/pages/Index.tsx`, rewrite `handleRefresh` so it does NOT reload the page:

1. `await flushNow()` (best effort).
2. `queryClient.removeQueries({ queryKey: ['following-feed', user?.id] })` and same for `following-count` and `following-has-posts`.
3. `await queryClient.refetchQueries({ queryKey: ['following-feed', user?.id], exact: true })` and refetch the two helper queries.
4. Return; no `window.location.reload()`, no artificial sleep.

This keeps the live Supabase session attached, so `auth.uid()` is always set when the RPC runs. The friend's new post will appear immediately after the pull-to-refresh resolves.

No backend / RPC changes needed for this issue. The pre-Jun-12 baseline already worked this way.

### Step 2 — Diagnose LinkedIn before patching

In build mode, run a Playwright script that:

1. Restores the Supabase session, navigates to `/`.
2. Finds the LinkedIn post card in the feed.
3. Logs the post's `external_url` / `media_url` from the DOM.
4. Captures a screenshot of the card and reads the inner HTML of the embed container.
5. Independently calls `buildLinkedInEmbed(url)` logic against that URL to confirm whether a match is produced.

Based on results, land one of:

- **A.** Extend `buildLinkedInEmbed` URL patterns (likely `/posts/<slug>` without the legacy `-activity-/-ugcPost-/-share-` infix; modern URLs use only a numeric activity ID at the end).
- **B.** If LinkedIn refuses to frame at all from `lovableproject.com`, render an `OgCardFallback` (we already use this for Facebook/Threads) instead of an empty iframe.

We only pick A vs B after seeing the captured evidence — no speculative URL-pattern changes.

### Step 3 — Verify

- Pull-to-refresh on Home with a brand-new friend post → post appears immediately, no "all caught up" flash.
- Refresh with truly nothing new → "all caught up" still shown correctly.
- LinkedIn post renders (or falls back cleanly to an OG card with the LinkedIn logo).

### Files expected to change

- `src/pages/Index.tsx` (refresh handler)
- `src/components/UniversalMetaEmbed.tsx` (LinkedIn — only after Playwright evidence)

No DB migration needed.

## Risk

**Success probability: 86%**

Risk on refresh fix is low — it's a straightforward removal of `window.location.reload()` and an in-place refetch. Risk on LinkedIn depends entirely on what Playwright reveals; the plan deliberately holds the patch until we have that evidence so we don't ship another guess.