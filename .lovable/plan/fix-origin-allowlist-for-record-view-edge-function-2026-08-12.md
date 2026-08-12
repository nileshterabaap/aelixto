Fix Origin allowlist for `record-view` Edge Function

Goal
Allow the Capacitor Android WebView (origin `https://localhost`) to POST to the `record-view` Edge Function without changing any other behavior.

Change
- In `supabase/functions/record-view/index.ts`, add `'https://localhost'` to the existing `allowedOrigins` array.
- Keep all existing origins and the origin-validation logic unchanged.

Deploy
- Deploy the updated `record-view` Edge Function so the live backend reflects the change.

Verify
- Send a test POST to `/functions/v1/record-view` with `Origin: https://localhost`.
- Confirm the response is no longer `{"ok":false,"reason":"Origin not allowed"}` with HTTP 403.

Excluded
No changes to authentication, viewer_id, device_hash, event_type, duration_ms, post_id, deduplication, scoring, rate limiting, tracking logic, Threads embeds, `useViewTracking`, `useOriginalVisitTracker`, or production origins.