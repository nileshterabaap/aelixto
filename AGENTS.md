# Project architecture

- Native startup uses the static OS splash only until the WebView paints, then hands off to the animated HTML splash; this preserves fast startup while allowing motion.