# Fix profile-grid reel lifecycle

## Problem
The grid viewer scrolls inside its own panel, while play confirmation currently checks only the page scroll position. A swipe over an embed can therefore be recorded as a play even though the user never played it. That false played state enables iframe destruction/reloading. Separately, the reload-cycle flag belongs to a temporary mounted element, so re-registration resets it and produces the inconsistent “reload once, then stop” behavior.

## Changes
- Replace page-only play confirmation with gesture-aware confirmation that watches pointer/touch movement and scrolling in any scrollable parent, including the profile-grid viewer.
- Keep lifecycle eligibility keyed by post identity rather than by a temporary rendered element.
- Never destroy or reload an iframe until that post has a confirmed play interaction.
- For genuinely played cross-platform embeds, suspend whenever they leave the usable viewport and restore them paused when they approach/return; remove the fragile one-refresh limit.
- Remove post-mount iframe attribute changes that themselves trigger an extra reload; required iframe restrictions remain defined at creation time.

## Verification
- Add focused tests for: unplayed repeated down/up passes, swipe-over-not-play, real play followed by repeated away/return passes, and remount/re-registration.
- Verify the grid in the website preview at desktop and mobile viewport sizes, including repeated direction changes.
- Check the latest build and runtime signals after implementation.

## Scope
Only profile/feed media lifecycle, play confirmation, and iframe reload behavior will change. Feed ordering, scoring rules, layout, ads, and other platform behavior remain untouched.
