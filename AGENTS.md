# Project architecture

- Native startup uses the static OS splash only until the WebView paints, then hands off to the animated HTML splash; this preserves fast startup while allowing motion.
- Media lifecycle is keyed by post and playback generation: play candidates remain repeatable after rejected swipe gestures, every confirmed play synchronously arms that post, and starting another video immediately pauses the previous one; score deduplication must never consume lifecycle detection.
- Platform-specific block viewers keep only the landed post's player mounted and use empty scroll-snap neighbours for motion; fresh selection matches a direct grid opening without changing shared embed/scoring logic, while other viewers retain full-list anchored scrolling.
- Grid position uses a read-only dial derived from rendered post ranks, isolated from media lifecycle and persistence so displaying position never records activity.