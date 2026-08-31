
-- allow new notification type
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['like','comment','repost','follow','follow_request','follow_accepted','message','report_outcome']));

CREATE OR REPLACE FUNCTION public.notif_scope_allowed(_recipient uuid, _actor uuid, _key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE pref text;
BEGIN
  SELECT COALESCE(NULLIF(p.settings->>_key, ''), 'everyone') INTO pref
  FROM public.profiles p WHERE p.user_id = _recipient;
  pref := COALESCE(pref, 'everyone');
  IF pref = 'off' THEN
    RETURN false;
  ELSIF pref = 'following' THEN
    RETURN EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = _recipient AND f.following_id = _actor);
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.notif_flag_allowed(_recipient uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT (p.settings->>_key)::boolean FROM public.profiles p WHERE p.user_id = _recipient), true);
$$;

REVOKE ALL ON FUNCTION public.notif_scope_allowed(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notif_flag_allowed(uuid, text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.handle_like_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE post_author_id UUID;
BEGIN
  SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
  IF post_author_id IS NOT NULL AND post_author_id != NEW.user_id
     AND public.notif_scope_allowed(post_author_id, NEW.user_id, 'notif_likes') THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
    VALUES (post_author_id, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_comment_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE post_author_id UUID;
BEGIN
  SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
  IF post_author_id IS NOT NULL AND post_author_id != NEW.user_id
     AND public.notif_scope_allowed(post_author_id, NEW.user_id, 'notif_comments') THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, post_id, comment_id)
    VALUES (post_author_id, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_repost_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE post_author_id UUID;
BEGIN
  SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
  IF post_author_id IS NOT NULL AND post_author_id != NEW.user_id
     AND public.notif_scope_allowed(post_author_id, NEW.user_id, 'notif_reposts') THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
    VALUES (post_author_id, NEW.user_id, 'repost', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, actor_id, type, metadata)
  SELECT cp.user_id, NEW.sender_id, 'message',
         jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id
    AND NOT public.are_blocked(cp.user_id, NEW.sender_id)
    AND public.notif_scope_allowed(cp.user_id, NEW.sender_id, 'notif_messages');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_follow_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.following_id != NEW.follower_id
     AND public.notif_flag_allowed(NEW.following_id, 'notif_follows') THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_follow_request_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.requester_id <> NEW.target_id
     AND public.notif_flag_allowed(NEW.target_id, 'notif_follow_asks') THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type)
    VALUES (NEW.target_id, NEW.requester_id, 'follow_request');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_follow_request(_requester uuid, _approve boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  req_id uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO req_id
  FROM public.follow_requests
  WHERE requester_id = _requester AND target_id = me;

  IF req_id IS NULL THEN
    RETURN 'not_found';
  END IF;

  IF _approve THEN
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (_requester, me)
    ON CONFLICT DO NOTHING;

    IF public.notif_flag_allowed(_requester, 'notif_follow_accepted') THEN
      INSERT INTO public.notifications (recipient_id, actor_id, type)
      VALUES (_requester, me, 'follow_accepted');
    END IF;
  END IF;

  DELETE FROM public.follow_requests WHERE id = req_id;
  RETURN CASE WHEN _approve THEN 'approved' ELSE 'declined' END;
END;
$$;
