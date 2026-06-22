
-- =====================================================
-- 1) FOLLOW REQUESTS for private accounts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id)
);

GRANT SELECT, INSERT, DELETE ON public.follow_requests TO authenticated;
GRANT ALL ON public.follow_requests TO service_role;

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own follow requests"
  ON public.follow_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Requesters create requests"
  ON public.follow_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Requester or target can delete"
  ON public.follow_requests FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON public.follow_requests (target_id);
CREATE INDEX IF NOT EXISTS idx_follow_requests_requester ON public.follow_requests (requester_id);

-- =====================================================
-- 2) RPC: request_or_follow
-- Decides whether to insert into follows or follow_requests
-- based on target's privacy setting.
-- =====================================================
CREATE OR REPLACE FUNCTION public.request_or_follow(_target uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  is_private boolean := false;
  s jsonb;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _target = me THEN
    RETURN 'self';
  END IF;

  IF EXISTS (SELECT 1 FROM public.follows WHERE follower_id = me AND following_id = _target) THEN
    RETURN 'following';
  END IF;

  SELECT settings INTO s FROM public.profiles WHERE user_id = _target;
  IF s IS NOT NULL AND (s->>'is_private')::boolean IS TRUE THEN
    is_private := true;
  END IF;

  IF is_private THEN
    INSERT INTO public.follow_requests (requester_id, target_id)
    VALUES (me, _target)
    ON CONFLICT (requester_id, target_id) DO NOTHING;
    RETURN 'requested';
  ELSE
    INSERT INTO public.follows (follower_id, following_id)
    VALUES (me, _target)
    ON CONFLICT DO NOTHING;
    RETURN 'following';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_or_follow(uuid) TO authenticated;

-- =====================================================
-- 3) RPC: cancel_follow_or_request
-- =====================================================
CREATE OR REPLACE FUNCTION public.cancel_follow_or_request(_target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  DELETE FROM public.follows WHERE follower_id = me AND following_id = _target;
  DELETE FROM public.follow_requests WHERE requester_id = me AND target_id = _target;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_follow_or_request(uuid) TO authenticated;

-- =====================================================
-- 4) RPC: respond_to_follow_request
-- Target user approves or declines a pending request.
-- =====================================================
CREATE OR REPLACE FUNCTION public.respond_to_follow_request(_requester uuid, _approve boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  END IF;

  DELETE FROM public.follow_requests WHERE id = req_id;
  RETURN CASE WHEN _approve THEN 'approved' ELSE 'declined' END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_follow_request(uuid, boolean) TO authenticated;

-- =====================================================
-- 5) Notification triggers for follow_requests
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_follow_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requester_id <> NEW.target_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type)
    VALUES (NEW.target_id, NEW.requester_id, 'follow_request');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_follow_request_notification_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE actor_id = OLD.requester_id
    AND recipient_id = OLD.target_id
    AND type = 'follow_request';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_request_notify ON public.follow_requests;
CREATE TRIGGER trg_follow_request_notify
  AFTER INSERT ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_follow_request_notification();

DROP TRIGGER IF EXISTS trg_follow_request_notify_delete ON public.follow_requests;
CREATE TRIGGER trg_follow_request_notify_delete
  AFTER DELETE ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_follow_request_notification_delete();

-- =====================================================
-- 6) Extend post_views.event_type to include engagement clicks
-- =====================================================
ALTER TABLE public.post_views DROP CONSTRAINT IF EXISTS post_views_event_type_check;
ALTER TABLE public.post_views ADD CONSTRAINT post_views_event_type_check
  CHECK (event_type IN ('video_play','image_view','article_open','external_visit'));
