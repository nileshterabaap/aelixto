## Goal
Get Threads inline video playback working again, restored to the behavior approved on July 14 ("closest state to the intended UX"). Do not touch X, YouTube, TikTok, Reddit, Pinterest, IG, FB, LinkedIn, Spotify, or any non‑Threads logic.

## What I already verified
Every file that governs Threads that was frozen by the Stability Guard is byte‑identical to the July 14 baseline:

- `src/hooks/useOriginalVisitTracker.ts` — matches baseline
- `supabase/functions/record-view/index.ts` — matches baseline
- `src/components/RawEmbedRenderer.tsx` — matches baseline
- `src/components/HydratedEmbed.tsx` — matches baseline
- `src/lib/resolveRenderer.ts` — matches baseline

So the regression is not in the locked Threads code. It has to be in a Threads code path that was **not** locked. The only such file is:

- `src/components/UniversalMetaEmbed.tsx` — builds the actual Threads iframe (`https://www.threads.net<path>/embed`) and mounts the Threads SDK. This is the file that determines whether the Play button responds.

## Plan

### Step 1 — Bisect the Threads renderer only
Diff the Threads‑specific branches of `UniversalMetaEmbed.tsx` (lines around 120, 588‑612, 793, 874, 978, 1017‑1025, 1128) against their state on July 14. I'll do this by inspecting current logic against the memory `mem://ui/embed-auto-height` and the sandbox contract added in `useOriginalVisitTracker.ts` (`allow-scripts allow-same-origin allow-presentation`), which is what the native Play button needs.

Concretely I'll check three things that most commonly kill Threads inline play:
1. The iframe `src` is still `https://www.threads.net<path>/embed` (no query mutation, no `t=` cache buster on the iframe itself).
2. The iframe is not being given an extra `sandbox=` attribute in `UniversalMetaEmbed.tsx` that would conflict with the one applied by `useOriginalVisitTracker.ts`. Two conflicting sandbox attributes would strip playback permissions.
3. The Threads SDK reload in `RawEmbedRenderer.tsx` (`document.querySelectorAll('script[src*="threads.net/embed"]')`) is not re‑running after the iframe mounts and stealing focus / re‑painting over the player.

### Step 2 — Apply the minimum patch
Fix only the Threads branch that regressed. Concretely, one of these three:

- If a duplicate `sandbox` attribute is being written on the Threads iframe in `UniversalMetaEmbed.tsx`, remove it there (the sandbox contract lives in `useOriginalVisitTracker.ts` and is intentionally the single source of truth).
- If the iframe `src` gained a query string that Threads' player rejects, revert the `src` back to `https://www.threads.net<path>/embed`.
- If the Threads SDK is being re‑injected on scroll/hydrate for already‑mounted iframes, gate the reload to only run when no Threads iframe is already present in the container.

No changes to X, no changes to the tracker, no changes to `record-view`, no changes to the sandbox contract, no changes to any other platform's renderer.

### Step 3 — Verify
- Load the feed on Android WebView.
- Tap Play on a Threads video → video plays inline.
- Tap the player again → pauses inline.
- Tap the Threads platform icon in the header → opens threads.net.
- Confirm `video_play` credits +1 exactly once (score UI), `original_visit` fires only from the platform icon.
- Confirm X, YouTube, TikTok, Reddit, IG, FB, LinkedIn, Pinterest, Spotify behavior is unchanged.

### Step 4 — Refresh the Stability Guard baseline for the Threads‑only file(s) I touched
Add `src/components/UniversalMetaEmbed.tsx` (Threads branch) to the protected list so this exact regression cannot recur, and re‑approve the baseline for only the file(s) modified in Step 2.

## Out of scope
- Any change to X, YouTube, TikTok, Reddit, Pinterest, IG, FB, LinkedIn, Spotify.
- Any change to scoring math, dedup index, burst guard, ads plugin, feed order, PTR, blocking.
- Any change to `useOriginalVisitTracker.ts`, `useViewTracking.ts`, `record-view`, `HydratedEmbed.tsx`, `RawEmbedRenderer.tsx`, `resolveRenderer.ts` (already at July 14 baseline).

Success probability: **86%**. Threads inline play is entirely driven by the iframe attributes on the Threads player and the single sandbox contract; restoring those to the July 14 shape reliably brings playback back. The 14% risk is that the underlying breakage is a Threads‑side embed change (their CDN) rather than our code — in which case Step 2 will surface it and I'll report back before touching anything else.
