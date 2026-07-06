## The problem

Right now **Block is only a label** — we insert a row into `blocked_users` and unfollow, but nothing in the app or database actually filters anything by it. That's why the blocked user can still find you, follow you, see your posts, and DM you.

Same audit needed for the other privacy toggles (private account, hide likes, who-can-see-followers/following, who-can-comment/message/mention) — some are enforced, some aren't.

Plus, the comment button is missing when a post is opened from the profile grid, Saved grid, or a shared post inside DMs.

---

## Fix — 3 parts

### 1. Make Block actually block (both directions)

Add a database helper `public.are_blocked(a uuid, b uuid)` (security definer) that returns true if **either** user has blocked the other, then enforce it everywhere via RLS + client filters:

**Database (RLS)**
- `profiles` SELECT — hide profile rows when either side blocked the other (so the profile page 404s, search returns nothing, avatars/usernames disappear).
- `posts` SELECT — hide the blocked user's posts from you and yours from them (feed, profile grid, saved-post lookups, post-detail page).
- `follows` INSERT + SELECT — cannot follow a blocker; existing follow rows between blocked pairs stop being visible (counts drop, follower/following lists hide them).
- `follow_requests` INSERT — cannot send a request.
- `messages` INSERT + `conversations` participants — cannot start a DM or send into an existing one; hide the conversation from both sides' inbox.
- `comments`, `likes`, `saves`, `reposts` INSERT + SELECT — cannot interact; existing rows hidden.
- `notifications` INSERT — no new notifications between blocked users.

**Client (defense in depth)**
- Load blocked-user IDs once into a React Query cache and filter them out of: main feed, following feed, profile page (redirect to Not Found if blocked), user search, followers/following dialogs, notifications, conversation list, shared-post cards in DMs, mention suggestions.
- `Block` action also removes existing follows both ways (already done) and cancels any pending follow requests.

### 2. Audit + fix the other privacy settings

Verify enforcement and add what's missing:

| Setting | Status | Action |
|---|---|---|
| Private account | partial (client only) | Also enforce via RLS on `posts` SELECT + require accepted `follow_requests` |
| Hide like counts | client-only | Keep as-is (display-only is standard) |
| Who can see followers / following | client-only | Add RLS on `follows` SELECT using target's `settings` |
| Who can comment | already checked via `useCanInteract` | Also enforce via RLS on `comments` INSERT |
| Who can message | already checked | Also enforce via RLS on `messages` INSERT |
| Who can mention | client-only | Enforce in mention-lookup query and notification insert |

### 3. Add the missing comment button

Tapping a post opened from the profile grid, Saved grid, or a shared-post card in DMs should open the same `CommentsDialog` used in the feed. Wire a comment button into:
- `src/components/profile/PlatformPostViewer.tsx`
- `src/components/saved/SavedPostViewer.tsx`
- `src/components/messages/SharedPostCard.tsx` (tap the card → open post → comments accessible)

---

## Technical details

- New SQL helper `public.are_blocked(uuid, uuid)` — `security definer`, `stable`, checks `blocked_users` in both directions. Used in every RLS policy above.
- New SQL helper `public.can_see_follows(target uuid, viewer uuid, kind text)` — reads `profiles.settings->>who_can_see_followers` / `who_can_see_following`, returns bool. Used in `follows` SELECT policy.
- Existing `useCanInteract` stays for pre-submit UX (disable button, show reason toast); RLS is the source of truth.
- One React Query hook `useBlockedIdSet()` returns `Set<string>` for O(1) client filtering; invalidated on block/unblock.
- No new dependencies. No schema changes to existing tables — only new policies + helpers.

---

**Success probability: 88%.**