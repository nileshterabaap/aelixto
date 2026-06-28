## Fix two small issues

### 1. Missing Pinterest & Article icons on draft/saved thumbnails

In `src/components/saved/DraftsGrid.tsx` and `src/components/saved/SavedThumbnailGrid.tsx`, the `PLATFORM_ICONS` map omits `pinterest` and `article`. Add them:

- `pinterest: pinterestIcon` (from `@/assets/platforms/pinterest.svg`)
- `article: articlesIcon` (from `@/assets/platforms/articles.svg`)

Result: Pinterest pins and article drafts show the correct corner badge instead of no icon.

### 2. Remove "[username] on Threads" caption above Threads posts

The text "Shon R. (@shotbyshon_) on Threads" comes from the Threads og:title being treated as the original source caption by `getOriginalPostCaption` in `src/lib/originalCaption.ts`.

Update `isJunkSourceCaption` (or the title-extraction step for `platform === 'threads'`) to discard any string matching the pattern:

```
/^.+?\s+\(@[^)]+\)\s+on Threads$/i
/^.+\s+on Threads$/i
```

So Threads posts only show the real post body (rendered by the Threads iframe), with no duplicate "X on Threads" line above the card.

No other files touched. PTR, Aelix score, feed RPC, and realtime hooks remain untouched.

Success probability: 95%.