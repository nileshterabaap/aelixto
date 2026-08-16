# Why Pinterest Feels Smoother — Analysis + Minimal Shared Fix

Read-only investigation complete. No files changed.

## 1. Exact reasons Pinterest feels smoother

`src/components/embeds/PinterestEmbed.tsx` is the only embed that combines all four smoothness mechanisms at once:

1. **Zero-roundtrip URL resolution** — the pin ID is pulled out with a synchronous regex (line 12-17), so `loading` starts as `false` for normal `/pin/<id>/` links and the iframe src (`assets.pinterest.com/ext/embed.html?id=…`, line 119) exists on the very first render. No oEmbed call, no OG scrape, no SDK script.
2. **Height reserved before the iframe exists** — the wrapper div gets a fixed pixel height seeded from the stored `suggestedHeight` (clamped 320–1400, default 600) at lines 31-35 and 113. Nothing shifts when content arrives.
3. **Skeleton stacked underneath, not swapped** — the pulse is `absolute inset-0` inside the same fixed-height relative wrapper (line 112-117), so skeleton and iframe occupy the identical box; the handoff causes no reflow.
4. **A real 300 ms opacity fade driven by the iframe's own `onLoad`** (lines 132-135) — one native event, no MutationObserver, no artificial timer.

The smoothness is **our implementation**, not the browser or Pinterest's SDK. Notably, Pinterest *opts out* of the shared `SkeletonGate`/`LazyEmbed` MutationObserver plumbing (it's rendered directly in `HydratedEmbed.tsx:403-411`) and self-manages a tight load→fade instead.

## 2. Differences from every other platform

| | Instant src | Pre-reserved height | Stacked skeleton | Fade on load |
|---|---|---|---|---|
| **Pinterest** | yes | yes (fixed px) | yes | yes, 300 ms via `onLoad` |
| **Reddit** | no — async normalize + possible `expand-url` call before any iframe (`RedditEmbed.tsx:217-259`) | heuristic, changes after load | partial | no fade; readiness via `load` + 8.5 s fallback timer |
| **X / Twitter** | no — SDK script then `twttr.widgets.createTweet()` DOM replacement (`TwitterEmbed.tsx:55-79`) | no (generic `aspect-[4/3]` block + `-85px` margin hack) | no | none |
| **Threads** | src is sync, but mount is gated behind an IntersectionObserver + 6 s retry (`ThreadsEmbed.tsx:177-209`) | yes (default 280) | no | none |
| **LinkedIn** | yes | fixed 760 px always, never matches content | no | none, no loading state at all |
| **Instagram** | yes | estimate → postMessage MEASURE | yes | yes but only 180 ms, gated by a 2200 ms fallback timer, not `onLoad` |
| **Facebook** | yes | postMessage only, 12 s failure fallback | no | none |

Two structural gaps dominate: **no fade** (X, Threads, LinkedIn, Facebook, Reddit) and **no height reserved before mount** (X, Reddit partially).

## 3. Risk assessment for applying this globally

- **Low risk / purely visual:** adding a `relative` fixed-height wrapper + absolute pulse + opacity fade on `onLoad`. It changes no scoring, no navigation lock, no postMessage handling.
- **Medium risk:** the fade can *mask* a slow embed and, if the readiness signal never fires, leave content at `opacity: 0`. Mitigation: always pair the fade with a fallback reveal timer, and never gate `pointer-events` on it.
- **Blocked by the stability guard:** `PinterestEmbed.tsx`, `TwitterEmbed.tsx`, `LinkedInEmbed.tsx`, and `UniversalMetaEmbed.tsx` (Facebook + Instagram) are all frozen in `.stability-platforms.json`. Any edit fails `platform:check` and the production build. So X, LinkedIn, Facebook and Instagram **cannot** receive this without you clearing their baselines.
- **Threads-specific risk:** the transparent first-tap overlay is the single source of truth for `video_play`. A fade wrapper must sit *below* that overlay in z-order and must not intercept pointer events, or the one-shot play regresses.

## 4. Recommended smallest shared improvement

Extract Pinterest's pattern into one tiny reusable presentational wrapper and apply it only to the **unguarded** platforms.

### New file: `src/components/embeds/SmoothEmbedFrame.tsx`
A ~40-line presentational component: `relative` wrapper with a caller-supplied fixed height, an `absolute inset-0 animate-pulse bg-muted` skeleton while not ready, `opacity 0→1 / 300 ms ease` on the child, plus a safety timer (~2.5 s) that force-reveals so nothing can get stuck invisible. `pointer-events` untouched. No data fetching, no measurement logic.

### Apply to (all unguarded):
- **Reddit** (`RedditEmbed.tsx`) — wrap the existing iframe; keep the current `computeInitialHeight`, postMessage height sync, collapsed-text cap and 8.5 s fallback exactly as-is. Only the fade + stacked skeleton are added.
- **Threads** (`ThreadsEmbed.tsx`) — wrap the iframe only, with the fade layer rendered strictly *beneath* the existing transparent play overlay. Visibility gate, retry, navigation lock and `video_play` capture untouched.

### Explicitly out of scope
Pinterest (already correct and frozen), X, LinkedIn, Facebook, Instagram — frozen. If you want those included later, you'd need to clear their guard baselines first; I'd do that as a separate, per-platform request.

### Verification
`npm run platform:check` must pass unchanged (all 10 platforms), plus a typecheck and build. Then manual confirmation that Reddit and Threads still play, still score, and still size correctly.

Probability of success: **93%** — the change is presentational and confined to two unguarded files.
