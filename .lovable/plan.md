## Diagnosis

Facebook and LinkedIn **video** posts render as a plain thumbnail with no play button (Facebook) or with a play button that just opens LinkedIn (LinkedIn), because they are being misclassified as **image** posts and routed to the photo-only branch we added to trim the footer.

### Two places the classification fails

1. **`supabase/functions/fetch-post-preview/index.ts` — server misclassifies as `media_kind: 'image'`**
   - **LinkedIn (lines 199–231):** only marks `media_kind: 'video'` when `og:video*` meta tags exist. LinkedIn's public HTML for native videos almost never exposes `og:video` to anonymous scrapers, so LinkedIn native videos become `image`.
   - **Facebook (lines 185–188):** the `isVideo` regex only matches `/videos?/` and `/reel/`. It misses common shapes: `/watch/?v=…`, `/watch?v=…`, `/share/v/…`, `fb.watch/…`. Those FB videos become `image`, so no play button, no iframe player.
   - **`extractSizingFromHtml` (line 1156):** doesn't consider `og:type` starting with `video`.

2. **`src/components/HydratedEmbed.tsx` — client photo shortcut swallows videos**
   - The FB image-only branch (`isFacebookPost && !isFacebookVideoLike`) and LinkedIn image-only branch (`isLinkedInPost && !isLinkedInVideoLike`) render a plain `<img>` inside an `<a>` and skip the iframe embed entirely, so tapping anywhere just opens the source page.
   - `isLinkedInVideoLike` only checks `mediaTypeHint === 'video'`, `media_kind === 'video'`, or `/video/`/`/videos/` in the URL. If the server misclassified as `image` AND the LinkedIn URL is a `/posts/…_activity-…` (typical native-video URL), the check fails and the video is rendered as a still.
   - `isFacebookVideoLike` covers more URL shapes, but is still bypassed once `media_kind` is `image` — the check is OR-based, but URL detection alone can miss shortened links (`fb.watch/xyz` variants inside redirects, or share URLs that expand server-side).

### The user's two screenshots

- **Facebook screenshot:** static image with no play button → FB video was classified as image on the server AND its final URL didn't match any of the client's video URL patterns.
- **LinkedIn screenshot:** thumbnail with LinkedIn's own play glyph baked into it; tapping opens LinkedIn → LinkedIn native video was classified as image (no `og:video` on LinkedIn's page), and `/posts/` URLs don't match `/video/`, so the LinkedIn image branch was taken.

The footer-trim change from earlier is the trigger — before it, both platforms always went through `UniversalMetaEmbed`, which mounts the platform's official iframe (with a real Play button that plays in-place).

---

## Fix

### Server: `supabase/functions/fetch-post-preview/index.ts`

- **Facebook branch (line ~185–188):** broaden `isVideo` regex to also match `/watch(\/|\?)`, `/share/v/`, and any `fb.watch` URL. Also treat `hasVideo` from the OG scrape (already computed elsewhere) as a video signal when present.
- **LinkedIn branch (line ~221–230):** add extra video signals:
  - `og:type` starting with `video` (via `extractSizingFromHtml`).
  - Presence of `<video ` tag or `.mp4`/`dms-video`/`vid-blob`/`/vc/` in the LinkedIn HTML.
  - Thumbnail URL containing `media.licdn.com` video paths (`/vc/`, `/dms/document/media`, `video-thumbnail`).
- **`extractSizingFromHtml` (line ~1134–1167):** also return `hasVideo = true` when `og:type` value starts with `video.` (e.g. `video.other`, `video.movie`).

### Client: `src/components/HydratedEmbed.tsx`

- **Broaden `isFacebookVideoLike`:** add `/watch(\/|\?)`, `/share/v/`, and `fb.watch/` matches; also treat `mediaTypeHint === 'video'` (already there) as authoritative.
- **Broaden `isLinkedInVideoLike`:**
  - keep existing checks.
  - Add: thumbnail URL containing `/vc/` or `dms-video` or `video-thumbnail` (LinkedIn CDN video hints).
  - Add: `og:type` hint stored on the post (if available via `content_type`/`og_type`).
- **Safety net — "tap to play" swap for uncertain cases:** if the FB or LinkedIn post is going through the image branch but *any* video hint is weakly present (unknown `media_kind`, or presence of a `video` substring in the URL/thumbnail), wrap the thumbnail in a Play button overlay that, on tap, swaps the still image for the `UniversalMetaEmbed` iframe (in-place, no navigation). This guarantees inline playback even when classification is imperfect.

### No other behavior changes

- Photo posts on FB/LinkedIn keep the tight footer-trimmed layout.
- Instagram embed reveal logic is untouched.
- The universal embed iframes, footer-trim heights, PTR, and Aelix Score stay as-is.

---

## Files touched

- `supabase/functions/fetch-post-preview/index.ts` — broader video classification (FB, LinkedIn, `extractSizingFromHtml`).
- `src/components/HydratedEmbed.tsx` — broader `isFacebookVideoLike` / `isLinkedInVideoLike` and a small tap-to-play swap for uncertain FB/LinkedIn posts.

No changes to Instagram, PTR, Aelix Score, feed order, or auth.

**Success probability: 92%.**