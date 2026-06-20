## Goal

Restore only the refresh / "You're all caught up" / feed-serving logic to its state **just before 12 Jun 16:16**, while keeping every other change you made between 12 Jun 16:16 and now intact.

## Strategy: Surgical rollback (not a History revert)

A History revert would wipe all unrelated work after 12 Jun 16:16. Instead, we restore *only the files that touch the feed-refresh / caught-up / serving system* back to their pre-12 Jun 16:16 state — everything else stays untouched.

## Step 1 — Identify the exact pre-16:16 baseline

Use `chat_search` / `recall_chat_history` to locate the assistant message immediately before the 12 Jun 16:16 prompt, and pull the verbatim contents of the feed-related files from that turn (and surrounding turns if needed).

## Step 2 — Define the scope (files in the blast radius)

Likely set, to be confirmed in Step 1:

1. `src/hooks/useFollowingFeed.ts` — refresh signature, fallback-to-previous-pages logic
2. `src/pages/Index.tsx` — `isRefreshingFeed`, `handleRefresh`, `shouldShowSkeleton`, PullToRefresh wiring, caught-up block
3. `src/components/PullToRefresh.tsx` — refreshingFallback / skeleton-trigger changes
4. `src/components/PostSkeleton.tsx` — visual tweaks tied to refresh
5. Supabase RPCs: `get_following_feed_v2`, `refresh_following_feed_v2` — including the 20260620045543 migration and any other migrations created on/after 12 Jun 16:16 that touched them

I will list the exact final set for your confirmation before any file is rewritten.

## Step 3 — Restore frontend files

Rewrite each in-scope file to its pre-16:16 contents exactly. No reinterpretation.

## Step 4 — Restore the RPC

Supabase migrations are append-only, so I create one new migration that redefines `refresh_following_feed_v2` (and `get_following_feed_v2` if needed) to their pre-16:16 bodies — recovered from the earlier migration files already in `supabase/migrations/`.

## Step 5 — Verify nothing else moved

- Diff confirms only the in-scope files changed
- Build passes
- Drive Playwright against the preview: load feed → pull-to-refresh → confirm behavior matches the pre-16:16 baseline (no infinite "caught up" loop, skeleton + content arrive correctly)

## Step 6 — Lock it

Add the in-scope files + RPCs to `STABILITY_GUARD.md` / stability-lock so future prompts can't silently re-break them without an explicit unlock.

## What you keep

Every change from 12 Jun 16:16 → now that is NOT part of the feed/refresh/caught-up/serving logic.

## What you lose

Only the feed/refresh attempts made from 12 Jun 16:16 onward.

## Risk / success probability

~85%. Two uncertainties:
- Whether chat history retains the verbatim file contents from just before 12 Jun 16:16 for every in-scope file. If any file isn't recoverable, I'll stop and ask you to paste it rather than guess.
- Whether any *other* file (outside the 4 above) was touched as part of those attempts. I'll surface the full confirmed file list after Step 1 before editing anything.

## Before I start, confirm:

1. Approve this surgical-rollback approach, and
2. If you remember any *other* file that was changed as part of the refresh/caught-up work after 12 Jun 16:16, name it so I add it to scope.
