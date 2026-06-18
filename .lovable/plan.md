## Goal

Reddit's official `embed.reddit.com` iframe is unreliable for image and gallery submissions (frequent blank frames, oversized chrome, and inconsistent height postMessages). For those two `mediaKind` values, skip the iframe entirely and reuse the fallback card path already in `RedditEmbed.tsx`, which renders the real post thumbnail (or direct media) wrapped in a link to the original post.

## Change

**File:** `src/components/embeds/RedditEmbed.tsx`

1. Extract the existing fallback JSX (the `isDirectMedia` / `fallbackImage` / generic-card branch currently inside `if (!resolvedUrl || failed || !embedSrc)`) into a local `renderFallbackCard()` helper so it can be reused without duplicating ~45 lines.
2. Add an early short-circuit just before the iframe render:
   - If `mediaKind === "image"` or `mediaKind === "gallery"`, return `renderFallbackCard()` instead of the iframe.
3. The existing failure branch keeps calling the same helper, so behavior for text/video/article posts is unchanged.

## Out of scope

- No changes to scoring, view tracking, data fetching, RLS, or any other component.
- The other items from the earlier batched request (`--profile-cover` token, `formatCount` 10k threshold, `fab-press` boxShadow keyframe) are skipped — they either don't match the current code or are already implemented.
- `LinkPreviewCard` is not used here; its prop shape (`domain`, `favicon`, `siteName`) doesn't match what `RedditEmbed` has, and `OgCardFallback` already covers this use case consistently with the rest of the embed system.
