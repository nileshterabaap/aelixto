# Fix grid players after scrolling

## Goal
Keep untouched grid videos loaded and tappable. Continue stopping only videos that have genuinely played when another video starts or they leave view.

## Changes
- Update the shared media lifecycle so an unplayed player is never muted, frozen, or replaced with a blank frame merely because another post starts playing.
- Preserve the existing confirmed-play lifecycle: once a video genuinely plays, it can be paused or hard-suspended off-screen and re-armed on a later confirmed play.
- Keep exclusive playback: starting video B still stops video A.
- Do not change Instagram-specific rendering, platform embed files, grid rendering, or scoring.

## Verification
- Confirm protected platform and scoring files remain unchanged.
- Check the app builds cleanly.
- In the website grid, inspect that starting one embed no longer adds frozen/muted/suspended state to untouched neighboring embeds; real cross-origin playback remains device-verified because automated browsers cannot decode these players.

## Technical detail
The current shared hook applies its pause/freeze stage to off-screen registrations even when `disableHardSuspend` marks them as never played. The fix will separate “never played” from “played but cycle completed” instead of routing both through the same pause transition.
