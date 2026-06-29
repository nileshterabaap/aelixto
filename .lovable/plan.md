## 1. Tighten message bubble corners (WhatsApp-style)

In `src/pages/Conversation.tsx`, change bubble container at line 320 from `rounded-2xl` (≈16px) to `rounded-lg` (≈8px) to match WhatsApp's subtler corners. No other styling changes — padding, tail/spacing, inline timestamp all stay.

## 2. Fix Quora "Content blocked by Quora protection" card

Quora aggressively blocks all UA fingerprints (mobile, desktop, r.jina.ai), so `unfurl-article` falls through to the placeholder that shows "Quora Post" + "Content blocked by Quora protection". We already have Firecrawl wired for non-Quora articles — extend it to Quora.

**Edit `supabase/functions/unfurl-article/index.ts`:**

- In the Quora branch, before returning the placeholder, add a Firecrawl Strategy 4:
  - `POST https://api.firecrawl.dev/v2/scrape` with `{ url, formats: ['html','markdown'], onlyMainContent: true, waitFor: 2500 }` and `Authorization: Bearer ${FIRECRAWL_API_KEY}`.
  - On success, set `html = data.html` and continue into the normal parsing path so the title (question text), description (first answer paragraph), og:image (author/answer image) and publishedTime get populated naturally.
- If Firecrawl also fails or `FIRECRAWL_API_KEY` is missing, keep the existing placeholder return — but improve it:
  - Derive a readable title from the URL slug (same logic already in `ArticleEmbed.tsx`'s Quora fallback) instead of literal "Quora Post".
  - Set `description: ''` so we no longer render "Content blocked by Quora protection" text in the card.

**Edit `src/features/article-embeds/ArticleContentEmbed.tsx`:** no change needed — once description is empty and Firecrawl populates real content, card renders cleanly with title + (optional) hero + excerpt + Continue Reading.

## Success probability
85% — bubble radius is a one-liner. Quora fix depends on Firecrawl rendering the page (it usually does for Quora since it runs a headless browser). If Firecrawl is rate-limited or the question is gated to logged-in users, the card will still render but without an excerpt/image — strictly better than today's "blocked" message.

## Technical notes
- Files touched: `src/pages/Conversation.tsx`, `supabase/functions/unfurl-article/index.ts`.
- No DB / RLS / client-state changes. PTR, Aelix score, mark-as-seen untouched.
- Firecrawl secret `FIRECRAWL_API_KEY` already configured (used by fetch-og line 831 and unfurl-article line 526).
