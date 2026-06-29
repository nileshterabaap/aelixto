## 1. Quora post card — render like Articles (image 2), not bare link

**Why it looks wrong now:** Quora URLs often fail to unfurl (Quora aggressively blocks scrapers), so `ArticleEmbed` falls back to `LinkPreviewCard` — that's the minimal favicon + domain + Continue Reading card you see. Medium works because its HTML scrapes fine and renders via `ArticleContentEmbed`.

**Fix (presentation only):**
- In `src/features/article-embeds/ArticleEmbed.tsx`, when the unfurl + fetch-og fallback still returns no usable data **and** the URL is Quora, build a minimal `UnfurlResult` object from the URL itself (title derived from the URL slug, Quora favicon, Quora as `site.name`) and render it through `ArticleContentEmbed` with `platform="quora"` instead of falling through to `LinkPreviewCard`.
- Also when partial data is returned (e.g. title is just the domain), enrich the `site.name` to "Quora" and keep the article-card path.
- Result: Quora posts always show the full card — bold title, thumbnail (when available), excerpt area, Quora favicon + "Quora" row, and the "Continue Reading" button — matching the Medium screenshot exactly.

No changes to `ArticleContentEmbed`, no backend changes, no impact on Reddit / other article platforms.

## 2. Message bubble timestamp — inline at bottom-right (WhatsApp style)

**Current:** bubble uses `flex flex-col`, so the time sits on its own line below the text → wastes vertical space (image 3).

**Wanted:** time hugs the bottom-right corner on the **same baseline** as the last text line, with text wrapping around it (image 4).

**Fix in `src/pages/Conversation.tsx` bubble markup:**
- Drop `flex flex-col` on the bubble.
- Render the time as a `<span>` floated right (`float-right`) inside/after the text node, with `ml-2 mt-1 leading-none` and a small `pl-1` so it never collides with the last word. Use the classic WhatsApp pattern:
  ```tsx
  <div className="max-w-[70%] rounded-2xl px-3 py-1.5 ...">
    <p className="text-sm whitespace-pre-wrap break-words">
      {message.content}
      <span className="float-right ml-2 mt-1 text-[10px] leading-none opacity-70 select-none">
        {formatTime(message.created_at)}
      </span>
    </p>
  </div>
  ```
- Tighten vertical padding to `py-1.5` so the bubble hugs the text height like the green WhatsApp bubble.
- Same treatment for the editing state is not needed (editing has its own input UI).

Result: single-line messages like "Hii" and "97.25" render with the timestamp tucked to the right on the same row, bubble height shrinks to match.

## Out of scope / safety
- No changes to PTR, feed RPC, Aelix score, realtime hooks, or any edge function.
- `SharedPostCard` already has no per-bubble timestamp — untouched.

Success probability: 95%.