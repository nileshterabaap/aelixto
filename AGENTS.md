# Project architecture

- Native startup uses the static OS splash only until the WebView paints, then hands off to the animated HTML splash; this preserves fast startup while allowing motion.
- Media lifecycle is keyed by post and playback generation: play candidates remain repeatable after rejected swipe gestures, every confirmed play synchronously arms that post, and starting another video immediately pauses the previous one; score deduplication must never consume lifecycle detection.
- Played embeds that leave the screen are unloaded and reload on-screen automatically when scrolled back into view (no "Tap to load" button); nothing is ever reloaded while off-screen. Waking is hysteresis-gated (real visible overlap + minimum time asleep + ~1s of continuous genuine visibility) because a just-blanked post above the viewport can flicker back across the edge and boot a background player that freezes the next tapped video.
- Unloading runs through a single teardown queue whose delay is one constant (currently zero, so the previous video stops the moment the next one plays or it leaves the screen); raising it trades instant stop for a quieter start of the new X/Threads player.
