## Problems

1. **X posts don't credit `original_visit`.** In `HydratedEmbed.tsx`, `platformHint === 'x' || 'twitter'` marks X as `isPlayableMediaPost=true`. That flag makes `useOriginalVisitTracker` only fire `firePlay` on tap and skip `fireOriginal`. Result: tapping into an X embed (which opens x.com or the X app) never records a visit.

2. **Threads video plays don't credit `video_play`.** Threads is `isPlayableMediaPost=true`, so `pointerdown` on the container is supposed to call `firePlay`. In practice Threads' iframe hands the tap off to the native app / new tab and the app is backgrounded before the play insert completes. Because `trackView` isn't a beacon and isn't retried, the request is aborted mid-flight when the tab hides. Additionally, some Threads plays go straight through the iframe with no synthetic pointerdown reaching the container.

3. **Profile feed doesn't show new posts on refresh.** `UserProfile.tsx`'s `handleRefresh` only calls `refetchProfile()` + `refreshFollow()`. It never invalidates `platform-posts` or `user-platform-tabs`, so pull-to-refresh on someone's profile leaves the grid stale.

## Fix

### 1. `src/components/HydratedEmbed.tsx`
Remove `twitter` / `x` from the `isPlayableMediaPost` list and drop `twitter.com/` / `x.com/` from the URL checks. X is a text/link platform for engagement scoring — tapping it should credit as `original_visit`, matching Reddit's behavior. (Twitter embeds that happen to contain video will still count as a visit, which is the correct signal for X per the user's request.)

### 2. `src/hooks/useOriginalVisitTracker.ts`
Make Play tracking survive the tap-out to a native app, and use a beacon:

- Add a new `firePlayBeacon()` variant that calls `trackViewBeforeNavigation({ postId, eventType: 'video_play' })` (a `navigator.sendBeacon` / `keepalive: true` request). Export a small `trackVideoPlayBeacon` from `useViewTracking.ts` that reuses the existing navigation-safe path.
- In `onPointerDown` for playable posts: fire the regular `firePlay()` immediately (best case, still on-page) AND arm a "pending play" flag.
- In `onVisibilityChange` (hidden) for playable posts: if a recent tap happened AND `playFiredRef` never confirmed success (or the pending flag is set), call `firePlayBeacon()` so the insert survives backgrounding. Still guarded once-per-post.
- Also attach `pointerdown`/`touchstart` capture listeners on the iframe element itself when it mounts (via the existing `attachIframeListeners` MutationObserver path), so Threads taps that don't bubble to the container still fire play.

This keeps behavior scoped to playable posts — no change for text platforms.

### 3. `src/pages/UserProfile.tsx`
Extend `handleRefresh` to also invalidate the grid queries for the profile being viewed:

```ts
const handleRefresh = useCallback(async () => {
  await Promise.all([
    refetchProfile(),
    refreshFollow(),
    queryClient.invalidateQueries({ queryKey: ["user-platform-tabs", profile?.user_id] }),
    queryClient.invalidateQueries({ queryKey: ["platform-posts", profile?.user_id] }),
  ]);
}, [refetchProfile, refreshFollow, queryClient, profile?.user_id]);
```

`queryClient` is already imported and used elsewhere in the file.

## Out of scope

- No changes to `record-view` edge function, scoring rules, or self-view logic.
- No changes to any other platform's tracking behavior.
- No UI/visual changes.

**Success probability: ~85%.**