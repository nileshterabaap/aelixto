## What's actually happening

The spinner vanishing the instant you lift your thumb is **not a gesture bug**. The gesture is firing correctly — we proved that with Playwright. The real bug is that the `PullToRefresh` component **gets unmounted from the DOM the moment refresh starts**, so its spinner disappears regardless of how the gesture is wired.

Every fix so far has been on the wrong component (PullToRefresh, SwipeableView, gesture handlers). That's why nothing moved the needle.

## The root cause

In `src/pages/Index.tsx`:

```ts
const loading = showDemoFeed ? demoLoading : followingLoading;
const shouldShowSkeleton = allPosts.length === 0 && (sessionLoading || loading);

if (shouldShowSkeleton) {
  return <SwipeableView>...<PostSkeleton />...</SwipeableView>;   // ← no PullToRefresh
}

return <SwipeableView>...<PullToRefresh>...</PullToRefresh></SwipeableView>;
```

And in `src/hooks/useFollowingFeed.ts`, `refresh()` does `setLoading(true)` and the hook's exported `loading` becomes `true` whenever `items.length === 0 && loading`.

Put together, in the very common "You're all caught up" state (`items.length === 0`):

1. You pull → spinner follows your finger (works).
2. You release → `runRefresh()` fires, animates spinner to resting position, calls `handleRefresh()`.
3. `handleRefresh` calls `refreshFollowingFeed()` → `setLoading(true)` synchronously.
4. Index re-renders: `loading = true`, `allPosts.length === 0` → `shouldShowSkeleton = true`.
5. The entire `PullToRefresh` subtree unmounts and is replaced by the skeleton branch.
6. Spinner disappears — not snapped back, **deleted**. This matches the symptom exactly.

Even when posts exist, the loader unmount path can be triggered during the brief window where state churns; but the empty-feed path is the one that's been killing us this whole time.

A secondary contributor: `refresh()` reuses the same `loading` state as initial load, so the hook can't tell "first ever load" from "user-triggered refresh." That's why `shouldShowSkeleton` ever fires during a refresh in the first place.

## The fix

Three small, surgical changes — all presentation/state plumbing, no gesture code:

1. **Stop unmounting `PullToRefresh` during refresh.** Restructure `Index.tsx` so `PullToRefresh` is the single root that wraps both the skeleton branch and the feed branch. The empty/caught-up message and the skeleton render *inside* it, never replace it. The spinner can then animate freely regardless of feed state.

2. **Separate "initial load" from "refresh" in `useFollowingFeed.ts`.** Add a `refreshing` flag distinct from `loading`. `refresh()` sets `refreshing` (not `loading`). Export `loading` as initial-load-only. The skeleton condition in `Index.tsx` becomes `allPosts.length === 0 && !hasReceivedPage` — it can never be true mid-refresh.

3. **Keep the spinner mounted for the full refresh cycle.** With (1) and (2), the existing `MIN_REFRESH_MS = 1200` and the resting-distance animation in `PullToRefresh` will finally be visible end-to-end: pull → release → spinner holds at rest → spinner snaps back smoothly.

### Files touched

- `src/pages/Index.tsx` — restructure so `<PullToRefresh>` wraps both skeleton and feed branches; render the empty/caught-up state inside it.
- `src/hooks/useFollowingFeed.ts` — add `refreshing` state, stop toggling `loading` inside `refresh()`, expose `loading` as initial-load-only.

No changes to `PullToRefresh.tsx`, `SwipeableView.tsx`, `useMarkPostSeen.ts`, or any gesture code. Those have been red herrings.

### How we'll verify (and not lie about it this time)

- Playwright touch-pull on `/` in the actual "caught up" state (`allPosts.length === 0`). Screenshot at: mid-pull, the instant after touchend, 600ms after touchend, and after spinner returns. The spinner must be visible in all four frames.
- Same test in the "has posts" state to confirm refresh still swaps the post list and the spinner still completes its full cycle.
- Console must stay clean — no errors, no warnings about unmounted components.
