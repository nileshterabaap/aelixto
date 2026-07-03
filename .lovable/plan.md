## Problems

**LinkedIn videos still redirect on tap**
`src/components/HydratedEmbed.tsx` has a LinkedIn "image card" branch that renders a plain `<img>` wrapped in an `<a>` whenever the server returned a thumbnail and the post is not confirmed as a video. LinkedIn's OG scrape almost never marks native videos as video (no `og:video` tag, poster URLs don't always contain `dms-video`/`/vc/`), so real videos hit this image branch → tap opens LinkedIn. Facebook works because its metadata is more reliable.

**Reddit posts and thumbnails not rendering**
Regression appeared alongside the recent Facebook/LinkedIn edits. Need to inspect edge-function logs and the current Reddit code path to identify what broke (candidates: `fetchRedditPreview` returning null after related refactors, `isMisleadingRedditThumbnail` over-filtering, or the RedditEmbed iframe sandbox/embed URL). Fix will be scoped to Reddit only.

## Fixes

1. **LinkedIn client-side gate — flip the default**
   In `src/components/HydratedEmbed.tsx`, only take the LinkedIn photo branch when we have **positive** confirmation the post is an image:
   - `post.media_kind === 'image'` (server-set) **AND** not a video signal.
   Otherwise fall through to `UniversalMetaEmbed` (iframe player with Play button), which is what worked before the recent photo-card change.
   Keep the existing Facebook photo branch untouched.

2. **LinkedIn server-side video detection — broaden**
   In `supabase/functions/fetch-post-preview/index.ts` LinkedIn branch, also mark as video when the URL/OG signals a video post even without `og:video`:
   - `og:type` starts with `video`
   - `twitter:player` present
   - Any `<video>` tag detected in the fetched HTML
   - LinkedIn URL patterns: `/video/`, `-video-activity-`, `urn:li:ugcPost` with video content-type header
   Redeploy the function.

3. **Reddit diagnosis + fix**
   - Pull recent `fetch-post-preview` logs filtered by `reddit` to see the actual failure (auth token, canonical resolve, or JSON fetch).
   - Verify `RedditEmbed` iframe still loads by reproducing in Playwright against the preview.
   - Likely repair points (apply the one that matches the log):
     a. `fetchRedditPreview` — ensure it still returns `thumbnail_url` when the OAuth token call fails (fallback to old.reddit JSON path).
     b. `isMisleadingRedditThumbnail` — loosen if it is now rejecting valid `i.redd.it`/`preview.redd.it` URLs.
     c. `RedditEmbed` iframe `sandbox` — restore `allow-popups-to-escape-sandbox` if Reddit's widget needs it for hydration.
   - Redeploy `fetch-post-preview` if edited.

## Verification

- Playwright against localhost preview: load one LinkedIn video post → Play button visible, tap plays inline (no redirect). Load one LinkedIn image post → renders as tight photo card. Load one Reddit link → iframe renders with post + thumbnail; if iframe fails, OG fallback card shows the real thumbnail.
- Confirm Facebook video + photo behaviors unchanged.

## Constraints

- No changes to feed order, PTR, Aelix score, or mark-as-seen.
- No changes to Instagram embed (locked working state).

Success probability: 85%.