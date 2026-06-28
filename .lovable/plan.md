## Goal
Make the chat thread look like Instagram: messages anchored to the bottom near the input, bubbles hug the text, and no per-bubble timestamp line.

## Changes (single file: `src/pages/Conversation.tsx`)

1. **Anchor messages to bottom (kills the empty space).**
   - On the `<main>` scroll container, add `flex flex-col` so its child can push to the bottom.
   - On the inner messages wrapper, add `mt-auto` and reduce vertical spacing from `space-y-4` → `space-y-1`. This way a short conversation sits right above the input bar (like Instagram), and long conversations still scroll normally.

2. **Remove per-bubble timestamp (compact bubbles).**
   - Delete the `<p className="text-[10px] mt-0.5 ...">{formatTime(...)}</p>` inside each bubble and the one under `SharedPostCard`.
   - Tighten bubble padding from `px-4 py-2` → `px-3.5 py-2` so "Hi"/"How" hug the text.

3. **Group-separator timestamps (Instagram-style).**
   - Show a centered muted timestamp line above a message only when >5 minutes since the previous message (or first message of the thread). Reuses existing `formatTime`.

4. **Tighten stacked spacing.**
   - Add `mt-2` only when the sender changes from the previous message, so consecutive bubbles from one person sit tightly together.

## Out of scope
- Header, input bar, SharedPostCard internals, realtime, unread badges, edit/unsend menu — all untouched.
- No avatars added.

Success probability: 95%.