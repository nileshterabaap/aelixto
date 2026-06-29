## Goal
Make Quora post cards render exactly like the Medium reference: bold title, hero image, 2–3 sentence excerpt with fade, "Quora • date" footer, and a "Continue Reading" button. No more bare slug-title cards.

## Why it's still failing today
`unfurl-article` tries mobile UA → desktop UA → r.jina.ai → Firecrawl for Quora. Quora's anti-bot rejects the first three on every request, so it always falls through to Firecrawl. The current Firecrawl call asks for `html` + `markdown` but the downstream parser is HTML-only — when Firecrawl returns sanitized "main content" HTML (no `<meta og:*>`, no `<h1>` wrapper, stripped first `<img>`), title/image/excerpt extraction yields nothing and we ship the minimal slug-only card.

## Plan

### 1. `supabase/functions/unfurl-article/index.ts` — Quora branch only
- Skip the three doomed pre-Firecrawl strategies for Quora. Go straight to Firecrawl (faster + reliable).
- Call Firecrawl v2 `scrape` requesting `formats: ['markdown', 'html', 'screenshot']` with `onlyMainContent: false` and `waitFor: 3500` so we get the full DOM including `<head>` (OG tags) and the first inline image.
- Build the response directly from Firecrawl's structured output instead of re-parsing HTML downstream:
  - `meta.title` ← `data.metadata.ogTitle` → `data.metadata.title` → first markdown `# heading` → URL slug.
  - `meta.image` ← `data.metadata.ogImage` → first `<img src>` in HTML whose host is `*.quoracdn.net` and is not a 1px tracker/avatar.
  - `meta.description` ← first 2 sentences of markdown body (strip the title line, skip "Sign in", "All related", "More answers"), truncated to ~200 chars with ellipsis.
  - `meta.publishedTime` ← `data.metadata.publishedTime` if present.
- Always return `kind: 'quora-post'` with `site.name: 'Quora'` and the Quora favicon, so `ArticleEmbed`'s router sends it to `ArticleContentEmbed` (the Medium-style card) instead of `LinkPreviewCard`.
- Only fall back to the slug-only minimal card if Firecrawl actually errors (no key / network failure).

### 2. `src/features/article-embeds/ArticleEmbed.tsx`
- Keep the Quora synthesis fallback that's already there, but drop the OG re-fetch detour for Quora (it always fails and just adds latency). For `rendererType === 'quora'`, trust the unfurl result.

### 3. `src/features/article-embeds/ArticleContentEmbed.tsx`
- No structural changes — it already renders the exact layout in the reference image. Just verify it doesn't strip the Firecrawl-provided `meta.description` when `content.html` is empty (the `parseContent()` fallback path already handles this; confirm with a quick read).

## What stays untouched
- Medium / generic article path
- Reddit embed routing
- PTR, Aelix score, mark-as-seen, realtime invalidations
- All other platform embeds

## Success probability
85% — Firecrawl with `onlyMainContent: false` reliably retrieves Quora OG metadata in our existing integration; the only residual risk is rate-limit / cold-start latency, mitigated by the existing skeleton state.
