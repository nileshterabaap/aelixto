## Goal

Rebuild pull-to-refresh on the Home feed from scratch so that pulling down fetches the next batch of unseen posts and shows them at the top, like Instagram/Twitter/Reddit.

## Backend (no changes needed)

The plumbing is already in place:
- `refresh_following_feed_v1(limit_count, seen_post_ids[])` RPC: records the seen IDs the client has accumulated, then returns the next page of unseen posts.
- `useFollowingFeed.refresh(seenIds)` already calls this RPC and replaces feed state with the fresh page.
- `useMarkPostSeen` exposes `takePendingSeenPostIds()` to hand off everything the user has dwelled on.

So the user's requirement ("on pull, show all unseen posts") is already satisfied by the existing `refresh` flow — what's missing is just the gesture + spinner UI on top of it.

## New component: `src/components/FeedPullToRefresh.tsx`

A small, single-purpose wrapper used **only on the Home feed**. Behavior:

1. Listens to `touchstart` / `touchmove` / `touchend` on its container (and a mouse-drag fallback for desktop testing).
2. Activates only when `window.scrollY === 0` AND the gesture is a clear downward swipe (vertical delta > horizontal, > 8px).
3. While dragging:
   - Translates the feed down with rubber-band resistance (1:1 up to threshold, then 0.4× past it).
   - Renders a circular spinner overlay at the top that fades in and rotates with pull distance.
4. Release behavior:
   - If pull ≥ 64px → snap to a "resting" 52px position, set `refreshing = true`, call `onRefresh()`.
   - Otherwise → spring back to 0.
5. While `refreshing`:
   - Spinner switches to an indeterminate spin animation.
   - Ignores new pull gestures.
   - When `onRefresh()` resolves, enforces a 500ms minimum so the spinner doesn't flash, then springs back to 0.
6. Cleans up listeners on unmount; uses `passive: false` on `touchmove` only while a pull is active so it can `preventDefault()` without blocking normal scroll.

Implementation uses framer-motion (`useMotionValue` + `animate`) which the project already uses elsewhere.

## Wiring in `src/pages/Index.tsx`

1. Re-add a `handleRefresh` callback:
   ```ts
   const handleRefresh = useCallback(async () => {
     const seenIds = takePendingSeenPostIds();
     try {
       await refreshFollowingFeed(seenIds);
       window.scrollTo({ top: 0, behavior: "auto" });
     } catch (e) {
       restorePendingSeenPostIds(seenIds);
       throw e;
     }
   }, [refreshFollowingFeed, takePendingSeenPostIds, restorePendingSeenPostIds]);
   ```
2. Wrap the `<main>` block with `<FeedPullToRefresh onRefresh={handleRefresh}>`.
3. Leave the rest of the page (Header, SwipeableView, CreatePostDialog) untouched.

## What stays removed

- The old `src/components/PullToRefresh.tsx` is not reused. The new component is isolated to Home only.
- No changes to `BottomNav`, `useFollowingFeed`, `useMarkPostSeen`, or any RPC.

## Acceptance

- Pulling down at the top of the Home feed reveals a spinner, snaps to a small resting state, and reloads the feed with unseen posts.
- After refresh: if more unseen posts exist, they replace the feed; if none, the "You're all caught up" empty state shows immediately (no extra tap or navigation needed).
- Pull gesture does not interfere with normal vertical scrolling or with the existing left/right `SwipeableView` swipe.
