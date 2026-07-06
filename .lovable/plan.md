## Goal
Make pull-to-refresh feel like Instagram: as long as the feed is scrolled to the top, dragging down from *anywhere* on the screen (over posts, embeds, thumbnails, whitespace) triggers the refresh — not just from the narrow area where touches currently reach the PTR container.

## Why it feels tight today
`src/components/PullToRefresh.tsx` attaches `touchstart/move/end` to its own inner `<div ref={containerRef}>`. Touches that land on:
- YouTube / Instagram / Reddit iframes (which swallow or don't bubble touches)
- The keep-alive wrappers / fixed overlays above the feed
- Any element with its own `touch-action` or that stops propagation

…never reach that inner div, so no pull is registered. That's why PTR only "catches" from certain spots.

## Changes (single file: `src/components/PullToRefresh.tsx`)

1. **Listen on `window` instead of the inner container.**
   Attach `touchstart/touchmove/touchend/touchcancel` to `window` (capture phase, passive) so every touch on the feed screen is seen, regardless of which element (iframe, overlay, embed) is under the finger.

2. **Gate by "is the page at the top?" not by touch target.**
   Keep the existing `isAtTop()` check (window scrollY + inner scroll containers both at 0). Drop the `shouldIgnorePullTarget` filter except for the bottom nav and the floating "Create post" button (so those stay tappable without accidental pulls).

3. **Re-anchor the start Y once the user reaches the top mid-gesture** (already implemented) — keep as-is; it's what makes the pull feel natural when the finger is already moving.

4. **Only activate on the feed route(s).**
   Add an optional `enabled` prop (default `true`) that the caller passes. Feed screens (`Index`, `SavedPosts`, `Notifications`, `Discover`, `Messages`, `UserProfile`) already wrap their content in `<PullToRefresh>`, so no caller changes needed — the window listener is scoped to whichever `<PullToRefresh>` is currently mounted.

5. **Keep the visual behavior identical:** same threshold (55px), same damping curve, same spinner overlay, same content-drag animation. Only the *touch capture surface* widens.

## Out of scope
- No changes to refresh callbacks, feed ordering, or Mark-as-Seen logic.
- No changes to the pages that consume `<PullToRefresh>`.
- No new dependencies.

## Success criteria
On the feed at scroll-top, dragging down from over a YouTube/IG embed, a thumbnail, or empty space all trigger the same pull animation and refresh — matching Instagram. Scrolling normally (not at top) still behaves normally.

Success probability: **90%**.