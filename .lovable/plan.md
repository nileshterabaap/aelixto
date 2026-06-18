## Plan: make pull-to-refresh usable again

### Goal

Fix the current problem first: pull-to-refresh feels too tight, barely triggers, and snaps back too fast, and pull to refresh in save section, notification, messages, profile also doesn't appearing after pulling. 

### What I’ll change

1. **Make the pull easier to start**
  - Loosen the gesture detection so a normal downward swipe at the top is accepted.
  - Reduce the trigger distance slightly so it doesn’t take many attempts.
2. **Make the animation less flashy**
  - Slow down the snap-back animation so it feels natural instead of instantly flashing away.
  - Keep the spinner visible long enough to confirm refresh actually happened.
3. **Avoid iframe/scroll interference**
  - Make sure the iframe scroll-freeze behavior does not make pull-to-refresh feel blocked or overly stiff.
4. **Keep the existing feed logic unchanged for now**
  - I will not touch the unseen-post / “caught up” logic in this step.
  - Once pulling feels normal again, we can use the existing `[PTR-DEBUG]` logs to fix the feed result issue separately.

### Files likely involved

- `src/components/PullToRefresh.tsx`
- Possibly `src/hooks/useIframeScrollFreeze.ts` only if it is interfering with touch handling

### Safety

No revert. No rebuild from scratch. Your latest version and recent updates stay intact.