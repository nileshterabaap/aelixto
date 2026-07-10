## What I'll change

### 1. Fix X text-based thumbnails on the grid
X posts store the tweet body in `preview_text` (via `fetch-og` description), but `getThumbnailText` only returns `preview_text` after content/title fail — and only if it isn't "generic". Confirm the pipeline and:

- In `src/lib/getThumbnailText.ts`, also mine the OG description-derived `preview_text` for tweets earlier, and strip leading `@handle:` / trailing `"pic.twitter.com/…"` fragments so the actual tweet body is what's shown.
- In `src/lib/getPostThumb.ts`, keep rejecting `pbs.twimg.com/profile_images/*` (avatars) but also reject Twitter's generic OG card image (`abs.twimg.com/*card*`, `pbs.twimg.com/card_img/*`) so the grid falls through to the text tile instead of showing a blank/broken image.
- In `src/components/profile/ProfilePlatformGrid.tsx`, when platform is `x`/`twitter` and no text is extracted, still render the branded X text card (currently `preferProfile` swaps to an avatar tile; drop that for X so the requested text-based thumbnail actually shows).

### 2. Fix Reddit media-based thumbnails on the grid
Reddit posts saved via the new preview pipeline already receive a real `thumbnail_url` (e.g. `i.redd.it/…`) for image/gallery posts, but the grid still falls to the text card because:

- `getPostThumb`'s Reddit branch returns `null` unless `media_url` itself is a direct image. When `thumbnail_url` is a real Reddit media URL (`i.redd.it`, `preview.redd.it`, `external-preview.redd.it`), it should be preferred and returned as-is.
- Rework the Reddit path in `src/lib/getPostThumb.ts`:
  1. If `thumbnail_url` is on `i.redd.it` / `preview.redd.it` / `external-preview.redd.it` / storage / `redditmedia.com`, return it.
  2. Otherwise keep the existing "reject misleading logos" behavior.
  3. Also accept `preview_image_url` when it's a Reddit media host.
- In `src/hooks/useUserPlatformPosts.ts`, force the background `backfillThumbnail` to always run for Reddit posts whose current thumbnail is missing OR is a `redditstatic`/`share.redd.it/preview/post` logo, so historical posts self-heal into real media thumbnails.

### 3. Live thumbnail preview during post creation for X, Threads, Reddit
Today `CreatePostDialog` step 2 only renders `<img src={thumbnailUrl}>`. For text-only X / Threads / Reddit posts there's no image, so the user sees nothing.

- In `src/components/CreatePostDialog.tsx` step 2, replace the raw `<img>` with a component that mirrors the final grid tile:
  - If `getPostThumb({...})` returns a URL → render the `<img>` exactly like the grid.
  - Else render `TextCardThumbnail` with the same `getThumbnailText` output (title / caption / `fetchedPreviewTextRef.current`) so the user sees the exact text-card the grid will show.
- Wire the preview into a synthetic post object built from current form state (`platform` from `classifyUrl`, `title`, `caption` as content, `thumbnailUrl`, `fetchedPreviewTextRef.current` as `preview_text`) so it updates the moment the fetch step finishes.
- Keep the "Remove thumbnail" affordance only when a real image thumbnail exists.

### 4. Android Google auth return-to-app — direct answer

Yes, with the current implementation the app should return automatically. Here's how it now works:

1. Tap Google sign-in → app opens a Chrome Custom Tab to the OAuth broker.
2. Broker finishes and redirects to `https://aelixto.com/~auth-bridge#access_token=...`.
3. `AuthBridge.tsx` immediately rewrites the location to an `intent://oauth-callback…;scheme=com.aelixto.app10;package=com.aelixto.app10;end` URL.
4. Android resolves that intent to the installed Aelixto app (guaranteed because we target the exact package).
5. `capacitor-init.ts`'s `App.addListener("appUrlOpen", …)` receives `com.aelixto.app10://oauth-callback#…`, parses the tokens, calls `supabase.auth.setSession`, and closes the Chrome Custom Tab with `Browser.close()`.

So the manual "switch back to app" step you had before is gone — as long as the APK is installed from the same package (`com.aelixto.app10`) and Chrome/Custom Tabs is available, Android hands control straight back to the app. If a device still gets stuck in the browser after this, it's almost always one of: (a) the APK is signed with a different package/keystore than the intent filter expects, or (b) the user picked "Open in browser" and blocked custom-tab handoff. Both are fixable at install time, not in code.

## Files touched

- `src/lib/getPostThumb.ts` — Reddit + X thumbnail rules
- `src/lib/getThumbnailText.ts` — better X tweet-body extraction
- `src/hooks/useUserPlatformPosts.ts` — force Reddit backfill for logo-only thumbnails
- `src/components/profile/ProfilePlatformGrid.tsx` — never fall back to author avatar for X
- `src/components/CreatePostDialog.tsx` — step-2 preview mirrors final grid tile (image OR text card)

No backend/DB changes. No changes to the Android auth flow — it already returns automatically as of the last update.

Success probability: ~88%.
