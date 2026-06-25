Success probability: 82%.

Plan:
1. Fix the random Facebook code showing as caption
   - Add a small client-side caption sanitizer before `CollapsibleCaption` renders source captions.
   - Treat Facebook bootstrap/script dumps like `window.requireLazy`, `ServerJSQueue`, `envFlush`, `ajaxpipe_token`, `Bootloader`, etc. as junk and render nothing for that original-caption block.
   - Keep normal Facebook/Reddit/Threads source captions untouched.

2. Prevent bad Facebook HTML from being saved/displayed as text
   - Tighten Facebook preview/embed handling so raw Facebook page HTML/script output is never accepted as a source caption or visible fallback text.
   - If an embed function returns page code instead of a real iframe/preview, ignore that text and let the existing Facebook embed/fallback path handle media.

3. Remove Facebook bottom whitespace
   - Adjust the Facebook iframe renderer to height-lock the wrapper itself, not only the iframe.
   - Use the saved/measured height when available, listen for Facebook resize messages, and clamp image-post height more tightly so the action bar sits directly below the image.
   - Do not change PTR, feed RPC, Aelix score, realtime invalidations, or mark-as-seen logic.

4. Verify
   - Check the feed on a mobile-sized viewport for the two shown cases: no code-like caption text above the Facebook post, and no large white gap below the Facebook image before Aelixto actions.