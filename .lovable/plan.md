## Problem

LinkedIn posts show the source caption twice: once as the "original caption" block that Aelixto renders above the embed (via `getOriginalPostCaption` in `HydratedFeedPost.tsx`), and again inside LinkedIn's own iframe player (`UniversalMetaEmbed`), which always renders the author's post text as part of the LinkedIn card.

Facebook doesn't have this issue because Facebook posts are routed to the direct-image branch in `HydratedEmbed.tsx` (no native caption is drawn). LinkedIn posts that are videos / non-confirmed-images fall through to the iframe player, which owns the caption — so ours becomes a duplicate.

## Fix

In `src/components/HydratedFeedPost.tsx`, extend the "skip original caption above the embed" guard that already covers `reddit`, `threads`, and `twitter` to also cover `linkedin` when the embed will render as an iframe (i.e. not the confirmed-image branch).

Concretely:

1. Compute an `isLinkedInIframeBranch` flag alongside `detectedPlatform`:
   - `detectedPlatform === 'linkedin'` AND the post is **not** a confirmed image (mirror the `isConfirmedLinkedInImage` check used in `HydratedEmbed.tsx`: `media_kind !== 'image'` and `mediaType !== 'image'`).
2. In the `originalPostCaption` render block (around the current `if (detectedPlatform === 'reddit' || 'threads' || 'twitter') return null;`), also return `null` when `isLinkedInIframeBranch` is true.
3. Leave the confirmed LinkedIn image branch untouched — that branch renders a plain `<img>` with no native caption, so the Aelixto caption above is still needed there.

No changes to:
- `HydratedEmbed.tsx` LinkedIn routing (still image branch for confirmed images, iframe otherwise).
- `originalCaption.ts` extraction logic.
- User's own caption (`post.content`) — still rendered above as normal.
- Facebook, Instagram, PTR, Aelix score, mark-as-seen, feed order.

## Verification

- Load a LinkedIn video/text post in the preview: only one copy of the caption is visible (the one inside the LinkedIn iframe).
- Load a LinkedIn image post: caption still appears above the image (no iframe present to duplicate it).
- Facebook video + photo posts unchanged.
- No regression to Instagram, Threads, X, Reddit caption rendering.

Success probability: 88%.