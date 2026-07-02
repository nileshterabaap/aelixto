
## 1. Unified video interaction (all platforms)

**Target behavior:** tap on Play area = play inline · tap anywhere else on card = open original.

- **Instagram** (`InstagramIframeEmbed`) — currently IG iframe eats every tap (plays fine, no way to open original). Add a top-right "Open on Instagram" pill button overlay (like Facebook already has via `HydratedFeedPost`'s open-original chip) rendered *outside* the iframe area so it never blocks the play region. Cross-origin IG iframe means we cannot detect "non-play" taps — the pill overlay is the only reliable path.
- **Facebook** (`FacebookIframeEmbed`) — remove the double-tap-focus-steal handler that currently launches the external URL. Single tap will pass to iframe (play/pause). Rely on the same "Open on Facebook" pill from `HydratedFeedPost`.
- **LinkedIn** (`LinkedInIframeEmbed`) — root cause of the "Play → redirects" bug is that LinkedIn's player calls `window.open` when it can't play (auth required / unsupported), and our global `window.open` override in `capacitor-init.ts` immediately kicks that to the native browser. Fix: for URLs whose origin matches the iframe's platform (linkedin.com), fall through to the default browser handler *without* the native app-launcher hop, so LinkedIn's own player popup can open in the same webview and video plays. Keep the app-launcher path for user-initiated `<a target="_blank">` clicks.

No other platforms touched.

## 2. Profile grid opens wrong post on first tap

Root cause in `PlatformPostViewer`:
- 180 ms `contentReady` gate + `profileReady` gate delays first render.
- Container's initial `scrollTop = 0`, so first paint always shows post #0.
- The anchor `useLayoutEffect` only runs after both gates, and the target post's DOM ref is not always registered on the first frame → `postRefs.current.get(targetPostId)` returns undefined and the anchor call no-ops. `ResizeObserver`/`MutationObserver` eventually recover, but by then the user sees post #0 for several seconds.

Fix:
- Set initial scroll position synchronously via a `ref` callback on the target post: when the tapped post's node first mounts, call `container.scrollTop = target.offsetTop` before paint. This works even before profile/contentReady resolves.
- Keep the existing ResizeObserver/MutationObserver anchoring for hydration reflow.
- Drop the `profileReady` skeleton gate (render posts immediately with a placeholder author; profile fills in async) so the tapped post is on screen within one frame.

## 3. Loading performance polish

- `prefetch.ts`: `prefetchFollowingFeed` sets `staleTime: 0`, forcing a refetch on every mount and killing perceived cache hits. Raise it to 30 s (matches feed hook) so warm returns to `/` are instant.
- `useUserPlatformPosts`: increase `staleTime`/`gcTime` so profile-grid returns feel instant on the second visit. (Read hook, apply small caching bump only.)
- `queryPersister.ts`: add `viewer-profile` and `user-platform-tabs` to persist whitelist so profiles are instant across sessions.

## 4. Signup screen flash on launch

Root cause: `Index` and `Auth` both wait for `useSession()` → session query resolves async → `Index` redirects to `/auth`, and `Auth` unconditionally renders its form during the check.

Fix:
- In `index.html`, keep the splash screen div visible until React commits (already done) — but do NOT dismiss it in `main.tsx` until the initial session probe resolves.
- Move splash dismissal after `supabase.auth.getSession()` completes and prime the React Query `['session']` cache before `createRoot().render()`.
- In `Auth.tsx`, render `null` (or the splash) while `sessionLoading` is true so the form never flashes.

---

### Technical details
- No DB changes.
- No changes to `useFollowingFeed`, `useMarkPostSeen`, PTR system, or RPCs — all the recently-restored functionality stays intact.
- Files touched: `src/components/UniversalMetaEmbed.tsx`, `src/capacitor-init.ts`, `src/components/profile/PlatformPostViewer.tsx`, `src/pages/Auth.tsx`, `src/main.tsx`, `src/lib/prefetch.ts`, `src/lib/queryPersister.ts`, `src/hooks/useUserPlatformPosts.ts`, and a small overlay change in `src/components/HydratedFeedPost.tsx` (or `HydratedEmbed.tsx`) to always show "Open on <platform>" for Instagram/Facebook/LinkedIn video embeds.

Success probability: **80%**.
