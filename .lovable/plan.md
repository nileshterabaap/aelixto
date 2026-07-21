# Facebook Reels: accept plugin frame, stop shifting

## Scope

Only `FacebookIframeEmbed` and `buildFacebookEmbed` inside `src/components/UniversalMetaEmbed.tsx`. No other files. No guarded platforms (`x`, `threads`, `linkedin`) touched.

## Root cause (already confirmed)

Facebook's `plugins/video.php` is a generic **video plugin**, not a reel-native embed. It wraps reels in its own player chrome and reports the **plugin frame** height via `postMessage`, not the reel's native dimensions. Facebook has no public reel-native endpoint (unlike Threads/Instagram `/embed/`). The recent viewport "shifting" comes from FB re-posting height whenever its chrome fades in/out on play/pause.

## Fix

Let Facebook's plugin drive height entirely. Remove every extra bit of logic that fights it.

1. **Remove the video-only `lockedRef` first-height lock.** For both video and static posts, adopt whatever height Facebook sends via `postMessage`, exactly as reported. No first-message freeze, no grow-only clamp.
2. **Remove `FB_FOOTER_TRIM`.** Wrapper height = iframe height (no negative offset). The plugin's footer is part of Facebook's native frame; hiding half of it is what makes the visible area feel unstable.
3. **Keep the `ResizeObserver` that rewrites `width` in the plugin URL** — that just tells FB the correct container width so its plugin lays out at the right size. This is not the source of shifting.
4. **Keep `MIN_HEIGHT` / `MAX_HEIGHT` as safety bounds only** (initial value + guard against absurd payloads). No aspect-ratio math.
5. **Keep the 12s render-failure fallback** to `OgCardFallback` unchanged.
6. **Keep sandbox removed and `allow=…autoplay; fullscreen…`** unchanged — Play works today.

Result: the container will match whatever Facebook decides the plugin frame is at each moment. If FB re-reports a slightly different height on play/pause, the frame grows/shrinks smoothly instead of the visible viewport top/bottom jumping (because there's no trim offset compressing it).

## Guarantees

- No changes to `ThreadsIframeEmbed`, `InstagramIframeEmbed`, `LinkedInEmbed`, or any other renderer.
- `buildFacebookEmbed` string output is unchanged (still `plugins/video.php` / `post.php` with `width=500`).
- Facebook's plugin chrome (player bar, reactions, footer) is now expected/accepted — this is the trade-off you approved.

## Post-edit checks

1. Run `npm run platform:check` — must pass clean for `x`, `threads`, `linkedin`.
2. If any guarded platform drifts, run `npm run platform:restore <name>` and stop.
