Success probability: 82%.

Plan:
1. Patch only the LinkedIn caption path in `fetch-post-preview` and the caption rendering gate; do not touch PTR, Aelix score, feed order, seen logic, auth, or post card sizing.
2. Make LinkedIn caption extraction more complete by reading the embed page more broadly:
   - keep the existing `attributed-text-segment-list__content` extraction;
   - add fallbacks for LinkedIn's escaped JSON/embed markup where full commentary is often stored outside the first matched `<div>`;
   - preserve paragraph breaks when converting HTML/escaped text to plain caption text.
3. Fix the current hydration condition so LinkedIn posts can refresh if the stored caption is obviously clipped (`...` / `…`) or much shorter than the newly fetched caption, not only when caption is missing.
4. Store the improved caption back into `preview_text` through the existing backend function update, so old LinkedIn posts self-heal after they render once.
5. Keep `CollapsibleCaption` behavior as-is (`... more` still expands), but ensure it receives the full source caption with paragraph gaps.
6. Deploy only the changed backend function after code changes, then do one targeted function test with a LinkedIn URL if one is available in current data/logs; otherwise validate the extraction logic structurally without affecting live feed behavior.