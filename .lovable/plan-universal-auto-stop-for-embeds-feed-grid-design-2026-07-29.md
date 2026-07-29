# Universal Auto Stop for Embeds (Feed + Grid) — Design

## 1. What exists today

The app already has a two-stage lifecycle engine in `src/hooks/useMediaPauseOnScroll.ts`, mounted from `src/components/HydratedEmbed.tsx` — the single embed entry point shared by Feed (`Index.tsx` -> `HydratedFeedPost`) and Grid (`PlatformPostViewer` -> `HydratedFeedPost`). So "identical behaviour in Feed and Grid" is already structurally guaranteed; no duplicate engine is needed.

Current stages:
- Stage A (near viewport): pause `<video>/<audio>`, postMessage-pause YouTube and Spotify, freeze pointer events, "mute" non-API iframes.
- Stage B (far away): hard-suspend by swapping `src` -> `about:blank`.

Two problems:
- Stage B is currently disabled everywhere (`disableHardSuspend: true` at `HydratedEmbed.tsx:143`) — this is exactly the February approach that caused reload flicker, so it was switched off. Cross-origin embeds (Threads, X, IG, FB, Pinterest, Reddit, LinkedIn) therefore keep playing audio/video off-screen.
- Stage A's "mute" path is cosmetic: setting `pointer-events: none` does not stop a cross-origin video.

## 2. Platform capability matrix

| Platform | Can truly pause? | Mechanism |
|---|---|---|
| YouTube | Yes | postMessage `pauseVideo` (already wired; needs `enablejsapi=1` + origin) |
| Spotify | Yes | postMessage `{command:'pause'}` (already wired) |
| Native `<video>`/`<audio>` (uploads, some OG media) | Yes | `.pause()` |
| Vimeo / Player.js-style | Yes | postMessage (if ever added) |
| Threads, Instagram, Facebook | No public pause API | cross-origin; only recreation or focus tricks |
| X (Twitter) | No | cross-origin widget iframe |
| Pinterest, Reddit, LinkedIn, TikTok | No | cross-origin |

So: 3 truly-pausable classes, everything else needs an indirect strategy.

## 3. Strategies evaluated

1. **Unmount / conditional render** — kills embed state, forces full re-fetch + skeleton on scroll-back. This is the February failure mode. Rejected.
2. **`src` -> `about:blank` hard suspend (current Stage B)** — reliably stops audio, but re-navigation costs 300-1500ms and a visible reload. Acceptable only very far off-screen with hysteresis. Keep, but gate it hard.
3. **`display:none` on the iframe** — Chrome/WebKit do NOT reliably stop cross-origin media, and it destroys layout box -> layout shift. Rejected.
4. **`content-visibility: auto` + `contain-intrinsic-size`** — big win for paint/layout cost on long feeds, zero flicker, but does not stop audio. Keep as a performance layer, not as the stop mechanism.
5. **`visibility: hidden`** — no playback effect, causes the scroll bugs already noted in `KeepAlive.tsx`. Rejected.
6. **Muting via `allow` attribute mutation** — changing `allow` after load has no retroactive effect. Rejected.
7. **`src` reassignment to the *same* URL with a hash** — same cost as (2) with no benefit. Rejected.
8. **Volume trick / Web Audio interception** — impossible cross-origin. Rejected.
9. **`iframe.setAttribute('sandbox', ...)` re-application** — triggers a document reload (same cost as (2)) and would break the guarded nav-lock contract. Rejected.
10. **Focus-steal / blur** — no effect on autoplaying cross-origin video; also risks stealing the tap that drives `video_play`. Rejected.
11. **Page Visibility API** — only for tab/app background; keep as a separate global rule (pause everything on `visibilitychange`), which is cheap and correct.
12. **Per-platform hybrid** — the only design that meets all constraints.

## 4. Recommended architecture — "Three-ring lifecycle with hysteresis"

A single shared engine (extend `useMediaPauseOnScroll.ts`, keep the shared-observer design) with three rings around the viewport instead of the current two, plus dwell-based hysteresis so rapid scrolling never triggers the expensive ring.

```text
        |<---- ring C: DORMANT (>= ~5 screens, dwell >= 1200ms) ---->|
             |<---- ring B: STOPPED (~0.5-5 screens) ---->|
                    |<-- ring A: ACTIVE (in viewport) -->|
```

- **Ring A — ACTIVE.** Nothing is touched. Pointer events restored, scoring overlays armed. Identical to today's `active`.
- **Ring B — STOPPED (the new default "auto stop").** For pausable platforms: real pause (`.pause()`, YouTube/Spotify postMessage). For cross-origin platforms: no `src` change — instead the iframe is *interaction-frozen* (pointer-events off) and, critically, **only started at all once it entered Ring A**. Because every platform here requires a manual tap to play (there is no cross-origin autoplay on mobile in this app; TikTok/Reddit are already strict manual-play by policy), an embed that has never been tapped has nothing to stop. The only true leak is an embed the user *did* play and then scrolled past.
- **Ring C — DORMANT.** Only here do we `src` -> `about:blank`, and only when all three hold: (a) element is >= ~5 viewport heights away, (b) it has stayed there for >= 1200ms of dwell (hysteresis timer, cancelled if it re-enters ring B), (c) the embed was actually played (`data-aelix-played="1"`) or the tab is backgrounded. Height is pinned first via `contain-intrinsic-size` from the already-persisted embed height, so restoring produces zero layout shift.
- **Restore** happens at ring B on the way back — i.e. up to ~4 screens of runway before the user sees it — so the reload has finished long before the embed is on screen. This is the single most important difference from February, which restored at/near the viewport and therefore always showed the reload.
- **Played-flag.** The existing one-shot `video_play` capture paths (Threads catcher layer, `useOriginalVisitTracker`) already know when a post was played. They set a `data-aelix-played` attribute on the container; the lifecycle engine reads it. No changes to scoring logic, dedup, or nav lock — read-only consumption of a flag that gets written where the score already fires.
- **Global page-visibility rule.** On `document.visibilitychange -> hidden`, run the pausable-platform pause for everything and mark all played cross-origin embeds dormant-eligible immediately (no dwell). On return, restore ring A/B normally.
- **Scroll-velocity gate.** Reuse `src/hooks/useScrollVelocity.ts`: while flinging, suppress all ring transitions except pausing pausable media. No iframe recreation during a fling, ever.

### Why this beats the February attempt
| February | This design |
|---|---|
| Unmount / visibility toggle at/near viewport | Ring C only, >= 5 screens away |
| Instant transitions | 1200ms dwell hysteresis + velocity gate |
| Applied to every embed | Only embeds that were actually played |
| Restored when visible -> skeleton flash | Restored ~4 screens early -> invisible |
| Height recomputed on restore -> layout shift | Height pinned from persisted `suggestedHeight` |
| One strategy for all platforms | Real pause where APIs exist, recreation only as last resort |

## 5. Expected impact

- **Memory:** meaningful reduction. Each live cross-origin embed is a separate document (~8-25MB for FB/IG/Threads video). Dormant-ring recycling should cut steady-state feed memory 30-50% on long sessions, which also reduces WebView OOM kills in the APK.
- **CPU:** lower. Off-screen video decode is the largest sustained cost; stopping played embeds removes it. Observer cost is unchanged (still 2-3 shared observers, not per-post).
- **Battery:** the biggest win — off-screen decode + audio is the dominant drain today.
- **Scroll performance:** neutral-to-better. `content-visibility: auto` cuts style/layout work on off-screen cards; the velocity gate guarantees zero iframe work during flings.

## 6. Files that would change

Unguarded (safe to edit):
- `src/hooks/useMediaPauseOnScroll.ts` — core: third ring, dwell hysteresis, velocity gate, played-flag gate, visibilitychange rule.
- `src/components/HydratedEmbed.tsx` — pass real options (stop forcing `disableHardSuspend: true`), pass persisted height for intrinsic sizing, pass platform hint.
- `src/components/HydratedFeedPost.tsx` — set `data-aelix-played` when a play is registered; apply `content-visibility`/`contain-intrinsic-size` on the card wrapper.
- `src/components/embeds/ThreadsEmbed.tsx` — set the played flag inside the existing one-shot capture (one line; no change to the capture mechanics).
- `src/components/embeds/RedditEmbed.tsx`, `src/components/embeds/SmoothEmbedFrame.tsx` — keep the fade suppressed on lifecycle-driven restore so no skeleton flashes.
- `src/index.css` — intrinsic-size / containment utility classes.
- `src/App.tsx` — extend `useGlobalMediaPauseOnNavigate` with the visibilitychange rule.

Guarded — read-only, no edits planned: `useOriginalVisitTracker.ts` (x/threads/instagram), `UniversalMetaEmbed.tsx` (facebook/instagram), `TwitterEmbed.tsx`, `PinterestEmbed.tsx`, `LinkedInEmbed.tsx`, `RawEmbedRenderer.tsx` (spotify), article/Quora files. The played-flag is written from unguarded call sites only. `npm run platform:check` must pass unchanged.

## 7. Complexity and risk

- Complexity: medium. ~1 substantial file rewrite + 6 small edits. No schema, no edge functions, no new deps.
- Risk: medium-low, concentrated in two places: (1) accidentally suspending a Threads/X embed that owns a pending scoring tap — mitigated by never touching ring A/B iframes and by the played-flag gate; (2) restore timing on very fast long scrolls — mitigated by the 4-screen restore runway plus keeping the persisted-height placeholder.
- Rollback: a single `AUTO_STOP_ENABLED` flag in `src/config/embedFeatureFlags.ts` returns behaviour to today's exactly.

## 8. Suggested rollout

1. Engine + flag off, verify no behaviour change and guards pass.
2. Enable for pausable platforms only (YouTube, Spotify, native video) — zero recreation risk.
3. Enable ring C for played cross-origin embeds in Feed.
4. Enable in Grid, verify no treadmill regression in `PlatformPostViewer`.
