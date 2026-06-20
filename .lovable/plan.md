## Goal
Restore the LinkedIn rendering system to its exact state just before 12 Jun 16:16, while keeping every other change made between 12 Jun 16:16 and 15 Jun 04:15 intact.

## Scope of drift
After diffing the baseline commit (`ccd6258`, 12 Jun 12:10 UTC — the last commit before 16:16) against HEAD, the **only** LinkedIn-specific drift in the rendering system is inside one function:

- `src/components/UniversalMetaEmbed.tsx` → `buildLinkedInEmbed()`

All other LinkedIn touchpoints (`platformRegistry`, `resolveRenderer`, `HydratedEmbed`, `RawEmbedRenderer`, `index.css`, the `linkedin.svg` asset, EmbedSkeleton, thumbnails, etc.) are byte-identical to baseline or only differ in unrelated ways that must be preserved.

## Change

Revert `buildLinkedInEmbed()` in `src/components/UniversalMetaEmbed.tsx` to the baseline implementation:

- Remove the `liFrame(urn)` helper introduced later.
- Each of the three URL patterns (`/feed/update/...`, `/posts/..._ugcPost|activity-...`, `/posts/..._share-...`) emits an iframe with:
  - `width="100%"`, no fixed height
  - `style="border:none;overflow:hidden;display:block;aspect-ratio:4/5;"`
  - `loading="lazy"`, no `scrolling` attribute, no `min-height`, no white background

No other files are touched.

## Known trade-off (please confirm)
This is the same baseline that produced the original "LinkedIn isn't rendering posts" complaint — LinkedIn's cookie-consent banner can occupy the locked `4:5` area and visually clip the post. Restoring to that baseline re-introduces that behavior by definition. If you want the cookie-banner fix to stay, say so and I'll skip the LinkedIn revert (or keep only the URL-parsing parts of baseline).

## Verification
- Build passes.
- Diff against `ccd6258:src/components/UniversalMetaEmbed.tsx` for `buildLinkedInEmbed` is empty.
- Playwright smoke check that Home still loads without runtime errors.

**Success probability: 95%**
