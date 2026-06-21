## Goal

After you revert to the June 12 version, give you a clean, ordered rebuild list of only the changes between June 12 → June 15 that actually worked (no ones you later asked me to fix, redo, or improve), and store it somewhere that survives future reverts so you never have to re-explain.

## Why a normal file won't work

If I save the rebuild list as a project file (e.g. `docs/REBUILD.md`), reverting the project will erase it too. The only place that survives a project revert is **persistent memory** (`mem://`), which lives outside the codebase.

So the plan has two outputs:
1. A **memory entry** (`mem://rebuild/from-june-12`) — the durable rebuild list.
2. A **chat-visible summary** so you can read/copy it right now.

## Step 1 — Reconstruct the June 12 → June 15 timeline (read-only)

I'll search our chat history for that window and extract, per change:
- What you asked for
- What I changed (files + intent, not full diffs)
- Whether you later complained, asked for revision, or reverted it

Tools: `chat_search--search_chat_history`, `chat_search--read_chat_messages`.

## Step 2 — Classify each change

Each item gets one label:
- **Keep** — shipped, no follow-up complaint, no rework requested.
- **Skip** — you asked me to fix/redo it later, or it caused the regression you're escaping from (e.g. the refresh / mark-as-seen / RPC churn).
- **Uncertain** — I'll list these separately and ask you before including.

The refresh/feed/`useFollowingFeed`/`useMarkPostSeen`/`get_following_feed_v2` thread from the last few days will almost certainly land in **Skip**.

## Step 3 — Produce the rebuild list

Ordered by safest-first (independent UI tweaks → isolated features → anything touching feed/auth/RPC last), each item written as:

```
[ ] <short title>
    Files: <paths>
    Intent: <one line>
    Verify: <what to click/check after>
```

## Step 4 — Persist it

- Write `mem://rebuild/from-june-12` with the full list.
- Add a one-line pointer in `mem://index.md` under Memories so any future session picks it up automatically.
- Also paste the list into chat so you have it immediately.

After you revert, you just say "apply the rebuild list" and I'll work through it in order, verifying each step before moving on — instead of stacking fixes.

## What I need from you before starting

1. Confirm the window is **June 12 → June 15** (inclusive of the 15th).
2. Confirm you want the refresh / pull-to-refresh / mark-as-seen work classified as **Skip** by default (you can override per-item when you review the list).
3. Anything from that window you already know you want to **Skip** or **Keep** regardless of my classification.

Success probability: 90%.