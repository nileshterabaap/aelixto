Switch the conversation timestamps to WhatsApp style:

**Inside bubbles (per message):**
- Append a small time (e.g. `15:41`) inline at the bottom-right of each bubble, right after the text content.
- Format: 24-hour `HH:mm`.
- Style: ~10px, muted (lighter on own/green bubbles, gray on received), inline-flex so it sits beside the last line and wraps gracefully.

**Day separators (replacing the 5-minute time separator):**
- Show centered date chips between messages when the calendar day changes:
  - Today → `Today`
  - Yesterday → `Yesterday`
  - Within last 7 days → weekday (`Monday`)
  - Older → `D MMMM YYYY` (e.g. `17 August 2025`)
- Pill style: rounded, subtle background, small muted text — matches the existing centered separator look.

**File changes (UI only):**
- `src/pages/Conversation.tsx`
  - Replace `showTimeSeparator` (5-min gap) with `showDaySeparator` (calendar-day change) and render the date chip.
  - Add inline `HH:mm` timestamp inside each bubble (skip for `SharedPostCard` / editing state).
  - Keep tight stacking, bottom-anchor, long-press menu, reply, edit untouched.

No changes to data model, hooks, or message storage. Success probability: 95%.