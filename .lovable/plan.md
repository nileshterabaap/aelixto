## Plan

You confirmed two things:
- The spinner now travels further but still snaps back before locking — gesture isn't quite reaching the trigger.
- On the caught-up screen, behavior is purely visual: spinner should hold and the "caught up" message stays.

So this is **only a gesture-completion bug**, not a data bug.

**Why it still snaps:** In `PullToRefresh.tsx`, every `touchmove` re-checks `isAtTop()`. Once Brave starts its overscroll bounce, `scrollY` briefly ticks above 0 mid-pull, our check fails, and we cancel the gesture even though the user is still pulling down. The trigger distance (32px) is also slightly too high on this short screen.

**Fix (two small tweaks to `src/components/PullToRefresh.tsx` only):**

1. **Don't re-cancel mid-pull.** Check `isAtTop()` only at the moment we transition from `pending` → `pulling`. After that, trust the gesture until the user releases or actually pulls upward past the existing −24px cancel threshold. This stops Brave's micro-bounces from killing the gesture.

2. **Lower the trigger distance.** `TRIGGER_DISTANCE` 32 → 24 so the spinner locks into spinning state sooner. Keep `MAX_DISTANCE`, `REFRESH_RESTING_DISTANCE`, `MIN_REFRESH_MS` (1200ms hold), and all spring values unchanged.

**Not changing:**
- `useFollowingFeed`, the refresh RPC, the "seen" filter logic — caught-up message will keep showing as you want.
- `SwipeableView`, `Index.tsx`, `index.css`.
- Behavior on Saved/Notifications/Profile/Messages stays identical (they already worked; these tweaks only make the trigger easier to hit and remove a spurious cancel).

**Verify:** Pull down on Home's "You're all caught up". Spinner should now travel, lock into the spinning state, hold ~1.2s, and glide back — with the caught-up message still showing afterward.