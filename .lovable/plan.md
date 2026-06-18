The user wants to simplify two existing functions by reverting them to earlier, leaner implementations:

### 1. src/components/PullToRefresh.tsx — `runRefresh`
Replace the current `runRefresh` (which includes `console.info` / `console.error` logs, `MIN_REFRESH_MS` enforced visible delay, `Date.now()` tracking, and `gestureRef.current = "idle"`) with a clean callback that:
- Guards against double-trigger with `refreshingRef.current`
- Sets `refreshingRef.current = true` and `setRefreshing(true)`
- Springs the spinner to `REFRESH_RESTING_DISTANCE`
- Awaits `onRefresh()`
- Springs back to 0 in `finally`, resetting `refreshingRef` and `setRefreshing(false)`
- Removes all instrumentation and the minimum-duration timer

### 2. src/pages/Index.tsx — `handleRefresh`
Replace the current `handleRefresh` (which flushes pending seen IDs, logs, invalidates the following-count query, and restores seen IDs on error) with a single-line async callback that simply calls `await refreshFollowingFeed()`.

### Technical detail
Both changes are isolated replacements inside existing `useCallback` hooks. No other logic in `Index.tsx` or `PullToRefresh.tsx` is affected. The `useMarkPostSeen` helpers (`takePendingSeenPostIds`, `restorePendingSeenPostIds`) will remain imported but unused after this change.