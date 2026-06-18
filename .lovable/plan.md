## Plan

**Root cause:** Brave/Chrome's built-in pull-to-refresh is competing with ours on Home, especially on the short "You're all caught up" view. Our spinner only gets a few pixels before the browser absorbs the rest of the pull.

**Fix (small, targeted):**

1. In `src/index.css`, add one rule: disable the browser's native overscroll/pull-to-refresh on `html, body` (`overscroll-behavior-y: none`). This globally hands the gesture to our `PullToRefresh` component on every page, so Home behaves like Saved.

2. In `src/pages/Index.tsx`, remove the `touch-action: pan-y` I added on `<main>` last turn. With overscroll disabled at the root it's unnecessary and could fight the gesture. Keep the `min-h-[calc(100vh-9rem)]` so the empty state still gives a full pull surface.

**Not changing:**
- No feed logic, no unseen-post filtering, no `useFollowingFeed`.
- No changes to `PullToRefresh` thresholds or timings (already tuned and working on the other pages).
- No changes to `SwipeableView` beyond what's already in place.

**Verify:** After the change, pull down on Home's caught-up screen — spinner should now travel the full pull distance, hold for ~1.2s, refresh, and glide back. Saved/Notifications/Profile/Messages stay unchanged.