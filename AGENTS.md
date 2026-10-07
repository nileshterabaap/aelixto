# Project architecture

- Native startup uses the static OS splash only until the WebView paints, then hands off to the animated HTML splash; this preserves fast startup while allowing motion.
- Media lifecycle is keyed by post and playback generation: play candidates remain repeatable after rejected swipe gestures, every confirmed play synchronously arms that post, and starting another video immediately pauses the previous one; score deduplication must never consume lifecycle detection.
- Played embeds that leave the screen are unloaded and stay asleep behind a "Tap to load" button; nothing is ever reloaded in the background, because background restarts left X/Threads players stuck or buffering on the next tap.
