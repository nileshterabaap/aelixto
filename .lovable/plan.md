Plan to apply safely:

1. Password change flow
- Update Settings > Change password dialog to ask for:
  - Current password
  - New password
  - Confirm new password
- Before updating the password, re-authenticate the current user with their current email + current password.
- If current password is wrong, show a clear error and do not update.
- Keep the existing new-password length and confirmation checks.

2. Quora thumbnail root fix
- Patch the Quora article unfurl function only; do not touch feed refresh, PTR, Aelix score, or feed ordering.
- Improve Quora image extraction using the same style of fallback chain that worked for Reddit/articles:
  - metadata image fields first
  - HTML `src`, `data-src`, `data-original`, lazy image attributes, and `srcset`
  - markdown images
  - JSON/escaped image URLs embedded in page data
  - Quora CDN candidates (`qph.cf2.quoracdn.net`, `qph.cf2.quoracdn.net/main-qimg-*`, `quoracdn.net`)
- Filter out favicon/logo/avatar/profile/tracking images so it doesn’t show the wrong thumbnail.
- Normalize escaped URLs and HTML entities so Quora’s CDN URLs are usable.
- Save the Quora result to the existing preview cache so old no-image entries get replaced.

3. Quora image rendering fallback
- Keep Quora rendering through the article-style card.
- Ensure Quora CDN images are proxied through the existing image proxy when displayed.
- Harden the proxy request headers for Quora images with browser-like `Accept`/`Referer`, similar to platforms that hotlink-block thumbnails.
- If proxy fails, fallback behavior remains graceful rather than breaking the whole post card.

4. Validation
- Verify the Settings dialog fields and validation behavior in code.
- Deploy the changed backend functions after editing.
- Test Quora unfurl against a Quora URL shape and confirm the returned payload includes `meta.image` when an extractable image exists.

Success probability: 85%.