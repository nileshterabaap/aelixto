# Diagnose Threads regression: missing `video_play` + double `original_visit`

I need trace data before proposing a fix — the current code has three separate paths that can each emit `original_visit` and two that can emit `video_play`, and I can't tell from source alone which ones actually fired for your last interaction.

## What I'll do once you approve

**Step 1 — Query the trace, no code changes.**
Pull the last ~10 minutes of `trace_logs` for the Threads post plus its `post_views` rows, and build a chronological timeline of every event the hook emitted:

- `onPointerDown` — target tag, `insideIframe`, `isThreadsPost`, hit-test result
- `onWindowBlur` → setTimeout — `activeTag`, `activeInsideEl`
- `onVisibilityChange` — `msSincePointer`, `msSinceIframe`
- `firePlay` / `fireOriginal` — `alreadyFired` flag, `trackView:result`, `trackOriginalVisit:result`

**Step 2 — Correlate against the two known suspects.**

The code has these paths that can double-credit `original_visit` for Threads:

1. `onVisibilityChange` — I recently removed the `isThreadsPost()` early-return, so any app-background within 3s of a pointerdown now fires `fireOriginal` for Threads. This is intentional but may be firing on the wrong window.
2. `handleIframeFocus` on the `<iframe>` element itself — if `trackPlayableInteraction` is false at the moment the iframe first focuses (e.g. re-mount with stale prop), this fires `fireOriginal` instead of `firePlay`.
3. Two mounted instances of `useOriginalVisitTracker` for the same post (feed card + `PlatformPostViewer` open simultaneously) — each has its own `firedRef`, so both can fire, and `post_views` will keep both rows if their `device_hash + event_type` dedupe window has already expired between them.

For missing `video_play`:

1. `onPointerDown` hit-test — if the pointer coordinates fall outside the iframe rect (e.g. tap on the Threads header/footer chrome that sits in the parent DOM), `firePlay` never runs.
2. `onWindowBlur` setTimeout(0) — on mobile Chrome the `document.activeElement` after a cross-origin iframe tap can be `<body>`, not `IFRAME`, so the `firePlay` branch is skipped.
3. `handleIframeFocus` — cross-origin iframes on mobile often don't fire a DOM `focus` event on the parent-side `<iframe>` element.

**Step 3 — Report which specific paths ran, then propose the smallest targeted fix.**
No code changes until the trace conclusively identifies which of the above are the actual culprits.

## Technical details

Files I'll read (no edits):
- `src/hooks/useOriginalVisitTracker.ts` — already in context
- `src/components/HydratedEmbed.tsx` — confirm one vs. two mounts per post
- `src/components/profile/PlatformPostViewer.tsx` — check if it mounts its own tracker while the feed card is still mounted

Queries I'll run:
```sql
select ts, event, step, detail, error from public.trace_logs
where post_id = '<threads post id>' and ts > now() - interval '15 min'
order by ts;

select created_at, event_type, viewer_id, device_hash
from public.post_views
where post_id = '<threads post id>' and created_at > now() - interval '15 min'
order by created_at;
```

I need the Threads post_id from your last test (or I can pull the most recent Threads post from `posts`).

Success probability: **95%** (trace is already instrumented and proven to write).