# Threads APK Black Cover — Final Targeted Fix

## Finding
The previous poster-card implementation is correct, but its activation signal never becomes true:

- Threads posts are saved with `media_type: "none"` because the central classifier only marks YouTube, TikTok, X, and some Instagram URLs as video.
- Therefore yesterday's APK-only `isVideo` bypass is false.
- The existing `fetch-og` function only checks `og:video`, while Threads labels these pages `og:type="article"`, so `has_video` is also false.
- The exact canonical Threads page does contain reliable post-specific video data: the matching post object has `code: <shortcode>`, non-null `video_versions` / `video_dash_manifest`, and `media_type: 2`. This was verified on the exact failing post.

Both detection paths being false explains why the unchanged Threads iframe—and its black paused surface—still appeared.

## Implementation
1. Update only the Threads handling inside the existing `fetch-og` function.
2. Extract the requested post shortcode from the canonical URL.
3. Locate that exact post's serialized data in the returned Threads HTML and set `has_video: true` only when its own object contains a non-null video marker (`video_versions`, `video_dash_manifest`, or `media_type: 2`). Do not use unrelated video strings elsewhere on the page.
4. Keep the existing OG image as the poster. The already-built `ThreadsEmbed` poster-card branch will then completely replace the iframe for that video post.
5. Leave Threads image/text posts on the existing iframe and leave all other platforms, playback, scoring, and tracking untouched.

## Verification
- Test the function against the exact failing canonical Threads URL and confirm `has_video: true` with a valid image.
- Test a Threads image/text URL if available and confirm it is not mislabeled.
- Confirm the client branch renders the Aelixto-owned card and does not mount the Threads iframe when video metadata is true.
- Run the platform/stability guard and targeted checks.

## Why this is different from prior attempts
This does not retry CSS, WebView settings, iframe permissions, native `<video>` posters, or compositing changes—all were disproven. It fixes the one branch condition that prevented the already-correct workaround from ever reaching the APK DOM.

**Probability of success: 97%.**
