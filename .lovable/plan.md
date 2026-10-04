# Find exactly which part of auto-pause breaks X and Threads playback

## Idea
Auto-pause is not one thing. It does several separate actions on a video when you scroll away or play another one. One of them is likely what makes X buffer and Threads freeze. Instead of guessing, we switch these actions on and off one at a time and let the recorder show which one causes the problem.

The separate actions:
1. **Mute** – silences the X/Threads video when it leaves the screen.
2. **Freeze taps** – blocks taps on videos that are off screen, and unblocks them when they come back.
3. **Sleep and reload** – empties the video once it's off screen and loads it again when you scroll back (with a grey cover while it reloads).
4. **Pause-the-previous** – when you play a new video, the old one gets stopped (this uses actions 1–3).
5. **Tap-freeze while scrolling** – blocks taps on every video while the page is moving.

## What gets built
- A small **"Test mode"** section in the dial menu with an on/off switch for each action above. Everything starts on, so the app behaves exactly like today.
- Your choices are saved, so they stay the same when you leave and come back to the grid.
- Each recorder event and each label saves which switches were on at the time. That way the records sort themselves into groups automatically.
- A "Pre-auto-pause" preset that turns every switch off. This should match the old version that worked for you, so we can confirm the problem goes away.

## How you test (about 10 minutes per round)
1. Turn on the "Pre-auto-pause" preset and play 5–6 X and Threads videos. Label them. Expect no freezes.
2. Turn everything on again, then turn off **one** action. Repeat for each action.
3. Tap **Save records** and tell me "check the records".

I'll compare freeze and buffer rates for each switch. The action that makes the problem go away when turned off is the cause. Then I'll fix just that action for X/Threads and keep auto-pause working.

## Scope
- Scores, feed order, ads and the grid layout stay the same. The platform and scoring locks stay in place.
- The switches only skip actions. They add no new behavior.
- The Test mode section is removed once the fix is in.

## Technical details
- Add a `lifecycleFlags` module (localStorage-backed): `mute`, `freezePointer`, `hardSuspend`, `exclusivePause`, `scrollFreeze`.
- Gate `muteNonApiIframes`, `freezeIframes`/`stageAPause`, `hardSuspendIframes`/`restoreHardSuspended`, `onConfirmedPlay` and the `scroll-freezing-iframes` class (useIframeScrollFreeze) on those flags.
- Recorder: `logDebug` and `addDebugLabel` include a `flags` snapshot. Analysis groups verdicts by flag set.
- The playedPosts.ts scoring-locked file is not touched.

Chance this pinpoints the cause: 85%. Chance of a targeted fix after that: about 75%.
