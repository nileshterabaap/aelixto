# Universal Article Embed System

A fully isolated feature for embedding and displaying written content from various platforms (Reddit, Medium, Quora, and generic blogs) with intelligent provider detection and graceful fallbacks.

## Architecture

### Edge Function: `/unfurl-article`

**Location:** `supabase/functions/unfurl-article/index.ts`

**Responsibilities:**
- Fetches HTML from target URLs with proper User-Agent headers
- Extracts Open Graph metadata (title, description, image, publish date)
- Parses main article content using heuristic-based extraction
- Sanitizes HTML to remove scripts, styles, and dangerous attributes
- Detects platform type (reddit-post, medium-article, quora-post, generic-article)
- Caches results in `link_previews` table with 24-hour TTL

**API Contract:**
```typescript
// Request
POST /unfurl-article
{ "url": "https://..." }

// Response
{
  "kind": "reddit-post" | "medium-article" | "quora-post" | "generic-article",
  "resolvedUrl": "https://...",
  "site": {
    "name": "Site Name",
    "domain": "example.com",
    "favicon": "https://..."
  },
  "meta": {
    "title": "Article Title",
    "description": "Article description...",
    "image": "https://..." | null,
    "publishedTime": "2025-01-01T00:00:00Z" | null
  },
  "content": {
    "html": "<p>Sanitized article content...</p>"
  }
}
```

### Database: `link_previews` Table

**Columns:**
- `id`: UUID (primary key)
- `url`: TEXT (unique) - Original URL
- `data`: JSONB - Cached unfurl result
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

**RLS Policies:**
- Public read access for all cached previews

**TTL:** 24 hours (refreshed on next access)

### Client Components

#### `ArticleEmbed.tsx`
Main orchestrator component that:
- Calls the `unfurl-article` edge function
- Shows loading skeleton during fetch
- Routes to appropriate sub-component based on `kind`
- Handles errors with fallback

#### Reddit posts
Reddit posts are routed to `@/components/embeds/RedditEmbed`, which uses Reddit's official `reddit-embed-bq` + `widgets.js` renderer and keeps the parent skeleton active until the widget iframe appears.

#### `ArticleContentEmbed.tsx`
Rich content card for Medium and generic articles:
- Displays hero image
- Shows site info with favicon and publish date
- Renders sanitized article HTML with prose styling
- Line-clamps content with expand/collapse toggle
- Includes copy link, share, and "Read full" actions

#### `LinkPreviewCard.tsx`
Fallback card for:
- Quora posts (which block embeds via CSP)
- Failed unfurls
- Generic link previews
- Shows image, title, description, domain

### Feature Flag

**Location:** `src/config/embedFeatureFlags.ts`

```typescript
export const EMBED_FEATURE_FLAGS = {
  // ... existing flags
  articles: true,  // Toggle Universal Article Embeds
}
```

### Integration Point

**Location:** `src/components/FeedPost.tsx`

The system is **completely isolated** from existing embeds. It only activates when:
1. `EMBED_FEATURE_FLAGS.articles` is `true`
2. Post has a `mediaUrl`
3. Platform matches: `reddit`, `medium`, `quora`, OR
4. Platform is generic (not Instagram, Facebook, Twitter, Pinterest, YouTube, TikTok, Spotify)

**Integration Logic:**
```typescript
{EMBED_FEATURE_FLAGS.articles && embedEnabled && post.mediaUrl && 
 (post.platform === 'reddit' || post.platform === 'medium' || post.platform === 'quora' ||
  (post.mediaType === 'none' && /* not other platforms */)) ? (
  <ArticleEmbed url={post.mediaUrl} />
) : null}
```

## Security

### HTML Sanitization
The system sanitizes all extracted HTML by:
- Removing `<script>` tags and content
- Removing `<style>` tags and content  
- Removing `<iframe>` tags
- Stripping event handlers (onclick, onload, etc.)
- Removing `javascript:` protocol from links

### Content Security Policy
Quora and platforms that block third-party embeds are handled gracefully:
- No iframe attempts (respects CSP)
- Falls back to link preview card with metadata

## Testing URLs

### Reddit
```
https://www.reddit.com/r/learnprogramming/comments/1ohdvqv/
```

### Medium
```
https://medium.com/@author/article-slug-123
```

### Quora (shows link card by design)
```
https://www.quora.com/question-slug
```

### Generic Blog
Any blog with Open Graph tags

## Performance

- **Caching:** All unfurls cached for 24 hours
- **Loading State:** Skeleton shown during fetch
- **Error Handling:** Graceful fallback to link card
- **No Blocking:** Existing embeds unaffected

## Disabling the Feature

Set `articles: false` in `src/config/embedFeatureFlags.ts` to completely disable the system without affecting other embeds.
