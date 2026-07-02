
-- Device tokens for native push (FCM/APNs)
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios','android')),
  bundle_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own device tokens"
  ON public.device_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own device tokens"
  ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own device tokens"
  ON public.device_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own device tokens"
  ON public.device_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);

CREATE TRIGGER device_tokens_set_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: fan out push when a notification row is inserted
CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name text;
  title text;
  body text;
  url text;
  project_url text := 'https://hhotresssetunubidrth.supabase.co';
  service_key text;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO actor_name
  FROM public.profiles WHERE user_id = NEW.actor_id LIMIT 1;

  IF NEW.type = 'follow' THEN
    title := actor_name || ' followed you';
    body  := '';
    url   := '/notifications';
  ELSIF NEW.type = 'like' THEN
    title := actor_name || ' liked your post';
    body  := '';
    url   := '/notifications';
  ELSIF NEW.type = 'comment' THEN
    title := actor_name || ' commented on your post';
    body  := '';
    url   := '/notifications';
  ELSIF NEW.type = 'repost' THEN
    title := actor_name || ' reposted your post';
    body  := '';
    url   := '/notifications';
  ELSE
    title := 'New notification';
    body  := '';
    url   := '/notifications';
  END IF;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'userId', NEW.recipient_id,
      'title', title,
      'body', body,
      'url', url
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block notification insert
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push ON public.notifications;
CREATE TRIGGER trg_notify_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_notification();
