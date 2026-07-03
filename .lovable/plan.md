Plan to restore the LinkedIn post card behavior shown in your first two screenshots:

1. **Remove the duplicated LinkedIn source caption above the embed**
   - In the hydrated feed card, LinkedIn currently renders the fetched original caption as gray text outside the LinkedIn iframe.
   - I’ll stop showing that extra caption for LinkedIn, so the flow becomes: Aelixto author header → your caption → LinkedIn embedded card, matching the first two screenshots.

2. **Restore LinkedIn iframe internal scrolling**
   - Current LinkedIn iframe auto-sizes/expands and uses `scrolling="no"`, which makes the page/card feel broken and prevents scrolling inside the LinkedIn card.
   - I’ll switch LinkedIn back to a fixed-height iframe viewport with `scrolling="auto"`, so the LinkedIn content scrolls inside the post card again.

3. **Ignore stale oversized LinkedIn height values**
   - Existing saved `suggested_height` values can keep forcing the bad expanded layout.
   - I’ll make LinkedIn use the restored fixed viewport instead of trusting stale measured heights.

4. **Verify with the preview**
   - I’ll check that LinkedIn cards no longer show duplicated gray source text and that the iframe has its own scrollable viewport.

**Success probability: 92%.**