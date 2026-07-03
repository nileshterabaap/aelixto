## Problem
Instagram Aelixto captions ("Good Night") don't render in the feed. The last fix updated `FeedPost.tsx`, but the feed actually renders posts via `HydratedFeedPost.tsx`, which still has an Instagram exclusion:

```
src/components/HydratedFeedPost.tsx:597
{detectedPlatform !== 'instagram' && post.content?.trim() && (
  <CollapsibleCaption content={post.content} />
)}
```

Since `RawEmbedRenderer` already strips the native Instagram caption, showing `post.content` is safe (no duplication).

## Fix
Remove the `detectedPlatform !== 'instagram'` guard so the user's Aelixto caption renders for Instagram posts too — matching every other platform.

Single-line change in `src/components/HydratedFeedPost.tsx`:

```
- {detectedPlatform !== 'instagram' && post.content?.trim() && (
+ {post.content?.trim() && (
```

Nothing else touched — Instagram embed height/glitch guard, PTR, Aelix score, and other platforms remain unchanged.

Success probability: 95%.