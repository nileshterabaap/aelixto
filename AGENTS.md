# Project architecture

- Native startup uses the static OS splash only until the WebView paints, then hands off to the animated HTML splash; this preserves fast startup while allowing motion.
- Media lifecycle is keyed by post and playback generation: never-played embeds stay mounted, while each confirmed play permits one off-screen suspend/restore cycle; this prevents scroll gestures from reloading media.