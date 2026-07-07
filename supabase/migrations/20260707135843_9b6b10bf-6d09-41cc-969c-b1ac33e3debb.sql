
-- 1. link_previews: restrict INSERT/UPDATE to service_role
DROP POLICY IF EXISTS "Service role can insert link previews" ON public.link_previews;
DROP POLICY IF EXISTS "Service role can update link previews" ON public.link_previews;
CREATE POLICY "Service role can insert link previews"
  ON public.link_previews FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update link previews"
  ON public.link_previews FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- 2. notifications: only server-side (SECURITY DEFINER triggers) may insert
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Only service role can insert notifications"
  ON public.notifications FOR INSERT TO service_role
  WITH CHECK (true);

-- 3. conversations: at minimum require an authenticated user
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Set search_path on the 4 functions that lack it
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 5. Revoke EXECUTE from anon/authenticated on server-only SECURITY DEFINER functions
--    Trigger functions run as table owner; no direct EXECUTE is required.
REVOKE EXECUTE ON FUNCTION public.notify_push_on_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_aelix_score() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_comment_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_follow_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_follow_notification_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_follow_request_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_follow_request_notification_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_like_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_like_notification_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_repost_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_repost_notification_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_likes_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_saves_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_comments_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_reposts_count() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_conversation_timestamp() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_hour_bucket() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_on_block() FROM anon, authenticated, PUBLIC;

-- 6. Storage: drop broad SELECT policies on public buckets to prevent listing.
--    Public URLs still serve files directly because the buckets are marked public.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Cover images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Post images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view thumbnails" ON storage.objects;
