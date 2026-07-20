Success probability: 86%.

Plan:
1. Patch only the Facebook embed renderer in `UniversalMetaEmbed.tsx`.
2. For non-video Facebook posts, put the height on the outer wrapper too — right now only the iframe has height, so the parent can still reserve extra space.
3. Add an image-post crop/trim mode: keep the Facebook iframe at the measured/plugin height, but show only the media-height portion in the wrapper so the white plugin footer cannot create a giant blank gap.
4. Ignore stale persisted Facebook heights that are clearly too tall for image posts, so old bad measurements stop reappearing.
5. Do not touch PTR, feed ordering, Aelix score, seen logic, auth, or backend functions.