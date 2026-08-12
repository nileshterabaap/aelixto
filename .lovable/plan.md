# Threads embed: our iframe vs Meta's official oEmbed output

Analysis only — no code changed.

## 1. What our code generates today

`src/components/UniversalMetaEmbed.tsx` (`buildThreadsEmbed`, line ~906) builds the iframe by hand from the post path:

```html
<iframe src="https://www.threads.net/@user/post/<CODE>/embed"
        style="border:0;width:100%;overflow:hidden;background:transparent;"
        scrolling="no" allowfullscreen allow="encrypted-media" loading="lazy"></iframe>
```

`ThreadsIframeEmbed` then re-renders it with `allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share"`, a fixed pixel height (default 280, clamp 220-1400) and a `postMessage` height listener. `src/components/embeds/ThreadsEmbed.tsx` builds the same `threads.net/@user/post/<code>/embed` URL.

## 2. What Meta's oEmbed returns

`GET https://graph.threads.com/oembed?url=<post>` (works without a token) returns `type: "rich"`, `width: 658`, and HTML that is **not** an iframe: a `<blockquote class="text-post-media" data-text-post-permalink="https://www.threads.com/t/<CODE>?utm_source=th_embed...">` placeholder card plus `<script async src="https://www.threads.com/embed.js"></script>`.

## 3. What embed.js actually does

Read from the live `embed.js` (module `PolarisBarcelonaEmbedSDKImpl`). It scans for `.text-post-media` blockquotes and creates the iframe itself:

- src = permalink with `/embed/` appended, i.e. `https://www.threads.com/t/<CODE>/embed/` (short `/t/` form, on **threads.com**)
- attributes: `allowTransparency`, `allowfullscreen`, `frameBorder=0`, `height=0`, `scrolling=no`, inline style with `height:0;border:none;border-radius:12px`
- **no `allow` attribute at all**, no sandbox, no extra media flags
- listens for a `postMessage` whose payload is a plain number and sets `iframe.style.height = data + "px"`; 10s timeout fallback

So embed.js performs **no media initialization whatsoever** — it is a discovery + sizing shim. The document that renders the video is the same `/embed` page in both paths.

## 4. Can the official embed run in our Android WebView?

Yes. With iframe fetch-metadata headers (`Sec-Fetch-Dest: iframe`) the `/embed` page returns 200 with **no** `X-Frame-Options` (a plain non-iframe GET returns `X-Frame-Options: DENY`, which is why raw curl looked blocked). Nothing about oEmbed is WebView-incompatible.

## 5. Concrete differences between our iframe and Meta's

| | Ours | Meta's |
|---|---|---|
| host | `www.threads.net` (301-redirects to .com) | `www.threads.com` directly |
| path form | `/@user/post/<CODE>/embed` | `/t/<CODE>/embed/` (trailing slash, utm params) |
| `allow` | `autoplay; encrypted-media; picture-in-picture; fullscreen; web-share` | absent |
| initial height | fixed px (default 280) | `height:0`, grown only by postMessage |
| loading | `lazy` | eager |

Also measured on the live `/embed` response: Threads itself sends
`permissions-policy: ... autoplay=(), encrypted-media=(), picture-in-picture=(), fullscreen=(self) ...`
so our `allow` list is overridden by Threads regardless — it changes nothing. The embed page renders a plain `<video controls loop>` (no DRM, so `encrypted-media` is irrelevant), and Threads' own CSP `media-src` already whitelists `android-webview-video-poster:`, i.e. they explicitly support the Android WebView poster path.

## 6. Is switching to oEmbed a credible next fix?

**No — not as a root-cause fix.** Both paths load the identical `/embed` document with the identical video element; embed.js contributes only sizing. The only substantive deltas are the `.net → .com` redirect hop, the `/t/` vs `/@user/post/` URL form, and initial height. None of those plausibly produce a grey/black first frame while audio/controls appear.

The two deltas worth a cheap, isolated test (not a rewrite):

1. Point the iframe at `https://www.threads.com/t/<CODE>/embed/` (exact official URL, removes the cross-host 301).
2. Drop our `allow` attribute so the iframe matches Meta's exactly.

Higher-value next step than any of this: attach `chrome://inspect` to the release WebView, inspect the Threads iframe's `<video>` element directly, and read `videoWidth/videoHeight`, `readyState`, and `error` after tapping play. That distinguishes "decoder never started" from "frame decoded but not composited" in one shot — which none of the logcats so far have settled.
