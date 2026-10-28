CREATE TABLE public.muted_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  muted_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, muted_user_id),
  CHECK (user_id <> muted_user_id)
);

GRANT SELECT, INSERT, DELETE ON public.muted_users TO authenticated;
GRANT ALL ON public.muted_users TO service_role;

ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mutes" ON public.muted_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can mute others" ON public.muted_users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unmute others" ON public.muted_users
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_post_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
  SELECT f.follower_id, NEW.user_id, 'new_post', NEW.id
  FROM public.follows f
  WHERE f.following_id = NEW.user_id
    AND f.follower_id <> NEW.user_id
    AND public.notif_flag_allowed(f.follower_id, 'notif_new_posts')
    AND NOT EXISTS (
      SELECT 1 FROM public.muted_users m
      WHERE m.user_id = f.follower_id AND m.muted_user_id = NEW.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.user_id = f.follower_id AND b.blocked_user_id = NEW.user_id)
         OR (b.user_id = NEW.user_id AND b.blocked_user_id = f.follower_id)
    );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_post_notification() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, actor_id, type, metadata)
  SELECT cp.user_id, NEW.sender_id, 'message',
         jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id
    AND NOT cp.muted
    AND NOT public.are_blocked(cp.user_id, NEW.sender_id)
    AND public.notif_scope_allowed(cp.user_id, NEW.sender_id, 'notif_messages');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_message_notification() FROM PUBLIC, anon, authenticated;