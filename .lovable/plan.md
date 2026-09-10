# Fix Android chat composer inset regression

## Root cause
- The September 1 edge-to-edge safe-area rollout added top inset protection to the conversation header, but never added bottom inset protection to the message composer. With the keyboard closed, the composer therefore extends behind Android’s navigation/gesture area.
- The affected phone’s measurements already proved Android resizes the WebView when the keyboard opens (`innerHeight` 716 → 417). The current leftover-height calculation can still briefly produce a non-zero `--kb` because keyboard and resize events settle at different times, creating the intermittent gap above the keyboard.

## Changes
1. Make Android WebView resizing the sole native keyboard-positioning mechanism: keep `--kb` at `0px` on native and use keyboard events only to toggle `kb-open`.
2. Give the conversation composer bottom padding from the existing `--safe-bottom` source when the keyboard is closed. The existing `html.kb-open { --safe-bottom: 0px; }` rule removes that padding while typing, so the composer meets the keyboard without a gap.
3. Remove leftover temporary diagnostic attributes from the conversation markup.
4. Preserve all existing safe-area, `100dvh`, `SystemBars`, Edge-to-Edge, and keyboard plugin configuration.

## Verification
- Confirm website behavior remains unchanged.
- Verify the closed composer reserves the Android bottom inset and the open composer does not.
- Check the project’s automated build result; the final Android behavior requires `npx cap sync android` and an on-device check.
