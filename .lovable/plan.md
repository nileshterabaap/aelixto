## Goal

Make pull-to-refresh genuinely usable everywhere it already exists, and confirm it's wired up on every page you listed.

## What I'll change

### 1. Make the pull much looser (`src/components/PullToRefresh.tsx`)

- **Start tracking sooner** — drop `PENDING_THRESHOLD` from 4px → 2px, so the gesture engages on the tiniest downward drag.
- **Allow more horizontal wobble before blocking** — change the "clearly horizontal" check from `|diffX| > diffY * 1.4` to `|diffX| > diffY * 2.2`, so a slightly-diagonal pull still counts as a pull (not a swipe).
- **Lower the trigger distance** — `TRIGGER_DISTANCE` 46 → 32px. Spinner activates after a small tug instead of a long drag.
- **Less resistance after trigger** — multiplier 0.55 → 0.7, so the finger keeps moving the spinner naturally.
- **Don't cancel on small upward jitter** — relax the upward-cancel from `diffY < -12` to `diffY < -24`.

### 2. Make the spinner clearly stop and spin (don't flash back)

- **Hold position longer during refresh** — `MIN_REFRESH_MS` 750 → 1200ms, so even on fast networks the spinner is visibly spinning.
- **Slow the snap-back animation** — reduce spring stiffness on the final close-up from 150 → 90, damping 22 → 24, mass 0.9 → 1.1. The spinner glides back instead of snapping.
- **Slow the snap-to-resting animation when refresh starts** — stiffness 140 → 100, so the transition from "pulled" to "spinning at rest" looks smooth, not jumpy.
- **Bump resting position slightly** — `REFRESH_RESTING_DISTANCE` 56 → 64px, giving the spinner more breathing room while it spins.

### 3. Add pull-to-refresh to your own Profile page

`src/pages/Profile.tsx` currently just redirects to `/u/<username>`. The destination (`UserProfile.tsx`) already wraps content in `PullToRefresh`, so once the looseness fix lands, pulling on your own profile will work. **No code change needed on Profile.tsx itself** — the redirect is correct.

### 4. Verify (no code change) the other pages you mentioned

- `Saved` → `src/pages/SavedPosts.tsx` — already wraps `<main>` in `<PullToRefresh>`. Will work after the looseness fix.
- `Notifications` → `src/pages/Notifications.tsx` — already wrapped. Same.
- `Messages` → `src/pages/Messages.tsx` — already wrapped. Same.

The reason it feels "missing" on those pages is the same root cause: the gesture is too tight to actually trigger. Loosening it fixes all of them at once.

## What stays untouched

- `useFollowingFeed.ts` and "You're all caught up" logic — not touched this round.
- The `[PTR-DEBUG]` console logs — still in place from earlier; we'll clean them up once the feed issue is solved.
- No revert, no rebuild. Your 5–6 recent updates stay intact.

## After implementation

I'll ask you to:
1. Pull down on Home — should engage almost immediately and clearly spin in place for ~1.2s before sliding back.
2. Try the same on Saved, Notifications, Messages, and your Profile — all should behave identically.

If any page still feels dead, that page has its own scroll container intercepting the touch and I'll patch it specifically.
