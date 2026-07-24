# Facebook Reel viewport — root cause and fix

## Root cause (answering your questions directly)

**1. Why doesn't our iframe render like Facebook's official embed?**

Facebook's official Reel iframe is a **fixed-size box**:
```html
<iframe src="…/plugins/video.php?href=…&show_text=false&width=267&height=476&…"
        width="267" height="476" …></iframe>
```
Notice: `width=267` **and** `height=476` are in **both** the src querystring **and** the iframe HTML attributes. The plugin renders to those exact numbers and doesn't need to renegotiate size.

Our generated iframe (`buildFacebookEmbed`, line 740-747) is:
```html
<iframe src="…/plugins/video.php?href=…&width=500"
        style="border:none;width:100%;overflow:hidden;" scrolling="no" …></iframe>
```
Differences that matter:
- We send only `width=500` in the src and **no `height`** — so the plugin must guess a height and then negotiate via postMessage.
- We set CSS `width:100%` instead of a pixel width — the visual width no longer matches the `width=500` we told the plugin, which is why the reel renders with letterboxing / off-axis crop.
- `FacebookIframeEmbed` (lines 341-458) then **rewrites the src** at runtime via `ResizeObserver` (`u.searchParams.set('width', containerWidth)`) and **overrides height** from postMessage. Every play/pause causes FB to re-post height → our container re-snaps → the visible viewport shifts. This is the exact shifting you're seeing.

**2. Why are we rebuilding the plugin URL?** Historical: we assumed CSS-fluid + postMessage was more responsive. It is not — for `video.php` reels it fights Facebook's own layout, which is designed around explicit `width`+`height`.

**3. Are we modifying width/height/src/CSS after creation?** Yes — three places:
- `ResizeObserver` rewrites `src` `width` param and remounts the iframe.
- `message` listener updates container `height` on every FB resize event.
- Wrapper uses `width:100%` + `position:absolute` iframe, overriding intrinsic attributes.

**4. Would Facebook's official iframe pasted verbatim render correctly?** Yes — because it carries its own `width`/`height` and the plugin's internal layout matches. Our wrapper's `width:100%` stretch is what breaks it.

## Fix — stop fighting Facebook, mirror the official embed

Scope: only `buildFacebookEmbed` and `FacebookIframeEmbed` in `src/components/UniversalMetaEmbed.tsx`. No other files. Guarded platforms (x, threads, linkedin) not touched.

1. **`buildFacebookEmbed`**: emit the plugin URL with **both `width` and `height`** in the querystring, matching Facebook's official Reel dimensions (`width=267&height=476` for videos; `width=500&height=<computed>` or FB's default for posts). Include `show_text=false` for videos (matches official).
2. **`FacebookIframeEmbed`**:
   - Delete the `ResizeObserver` that rewrites `src` `width`.
   - Delete the `message` listener that mutates height on the fly.
   - Delete `lockedRef`, `FB_FOOTER_TRIM`, `MAX_HEIGHT`/`MIN_HEIGHT` clamps, `suggestedHeight` seeding for videos.
   - Render the iframe at Facebook's fixed dimensions (267×476 for reels/videos). Center it in the wrapper (`display:flex; justify-content:center`) so the fixed-size player sits centered inside our card, exactly like the Blogspot test.
   - For static posts (`post.php`), keep width=500 and let FB's `postMessage` grow height (posts genuinely vary in height and FB supports that path), OR also switch to fixed height from the query — decide based on your preference (I'd default to fixed-width, postMessage-height for posts only, since text posts vary).
3. Keep `allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write; web-share"` and no sandbox — Play already works.
4. Keep the 12s no-render → `OgCardFallback` guard.

## Trade-off you should confirm

Fixed 267×476 means the Reel will render at Facebook's native size and will **not stretch to fill our card width** — it will sit centered with side padding on wider screens (this is exactly how the Blogspot test looks and matches Facebook's own embed everywhere else on the web). No more shifting on play/pause, no more crop.

If you'd rather the Reel fill the card width edge-to-edge, we can't get there via `plugins/video.php` — that would require a different embed strategy (options B/C from the previous investigation). Confirm before I implement:

- **A (recommended, matches official):** fixed 267×476, centered — no shifting, matches Blogspot.
- **B:** keep fluid width but accept the shifting — no change worth making.

## Post-edit checks
1. `npm run platform:check` — must pass clean for x, threads, linkedin.
2. Test the same Reel that renders correctly in Blogspot — should look identical in the app.

Success probability: 90% for option A.