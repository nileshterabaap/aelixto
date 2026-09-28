# Remove the two-day ad wait

## Changes
- Make native ad slots eligible immediately after consent and the Google ads SDK are ready.
- Remove the obsolete “Skip 2-day ad wait” setting and its stored override.
- Keep native-only delivery, test-mode selection, one ad per seven posts, request throttling, and Google no-fill handling unchanged.
- Update the internal ad setup notes so release behavior is accurately documented.

## Verification
- Check the affected ad paths for leftover install-age gating.
- Confirm the project builds and existing platform/scoring guards still pass.

**Expected success probability:** 98%. This removes Aelixto’s local delay, but Google can still return no-fill for live inventory.
