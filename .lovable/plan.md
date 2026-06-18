## Goal
Make pull-to-refresh reliably bring in posts created after the current feed loaded, instead of only cycling through “unseen” older posts or appearing to do nothing.

## Root issue
The current refresh path is not a true “latest feed refresh.” It calls `refresh_following_feed_v1`, which first writes visible/current posts into `post_seen`, then calls `get_following_feed_v2` with a null cursor. That feed function filters out anything already in `post_seen`, but it does not have a “newer than my current top post” mode.

That creates two bad behaviors:
- If the user has older unseen posts, refresh can return those instead of the newest post someone just created.
- If current posts were already marked seen by previous tracking/refreshes, the visible-page ID workaround does not prove PTR is fetching latest content; it just advances the seen filter.

## Plan
1. Add a backend RPC specifically for refresh-latest behavior:
   - Accept the current top feed timestamp/cursor plus the visible post IDs.
   - Mark visible/current posts as seen, same as today.
   - Query eligible followed posts/reposts newer than the current top item first.
   - Return those newest posts at the top.
   - If there are no newer posts, fall back to the normal unseen feed page so refresh still advances content.

2. Update `useFollowingFeed.refresh()`:
   - Pass the current top post’s sort timestamp/cursor metadata to the refresh RPC.
   - Merge newly returned newer posts above existing posts when appropriate, instead of blindly replacing the feed in a way that can hide the “new post arrived” result.
   - Keep the separate `refreshing` state that fixed the spinner disappearing.

3. Update `Index.tsx` refresh handler:
   - Continue sending currently rendered IDs as seen.
   - Also pass the current top feed item metadata into the hook so the backend can distinguish “new post since I loaded” from “older unseen post.”

4. Verify with the live app:
   - Log in via the preview session.
   - Capture current first post ID/time.
   - Trigger PTR and confirm the network call to the refresh RPC actually fires.
   - Confirm returned posts update React state and the first feed item changes when newer content exists.
   - Confirm the spinner still stays visible through the refresh cycle.

## Files expected to change
- `supabase/migrations/...` or backend migration for the new refresh RPC
- `src/hooks/useFollowingFeed.ts`
- `src/pages/Index.tsx`

## Non-goals
- No changes to pull gesture physics.
- No UI redesign.
- No account-linking prompts or demo-feed behavior changes.