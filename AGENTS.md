# Project architecture

- Native startup uses the static OS splash only until the WebView paints, then hands off to the animated HTML splash; this preserves fast startup while allowing motion.
- Media lifecycle is keyed by post and playback generation: never-played embeds stay mounted, every confirmed play synchronously arms that post, and starting another video immediately pauses the previous one; this avoids React timing gaps between adjacent grid videos.