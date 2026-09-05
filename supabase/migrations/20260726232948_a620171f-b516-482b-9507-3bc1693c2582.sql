CREATE OR REPLACE FUNCTION public.start_conversation(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _conv uuid;
  _perm text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _me = _other_user_id THEN RAISE EXCEPTION 'You cannot message yourself'; END IF;
  IF public.are_blocked(_me, _other_user_id) THEN RAISE EXCEPTION 'Unavailable'; END IF;

  SELECT COALESCE(p.settings->>'who_can_message', 'everyone') INTO _perm
  FROM public.profiles p WHERE p.user_id = _other_user_id;

  IF _perm = 'no_one' THEN
    RAISE EXCEPTION 'This user has disabled messages';
  ELSIF _perm = 'followers' THEN
    IF NOT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _me AND following_id = _other_user_id) THEN
      RAISE EXCEPTION 'Only followers can message this user';
    END IF;
  ELSIF _perm = 'following' THEN
    IF NOT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _other_user_id AND following_id = _me) THEN
      RAISE EXCEPTION 'Only people this user follows can message them';
    END IF;
  END IF;

  SELECT cp.conversation_id INTO _conv
  FROM public.conversation_participants cp
  JOIN public.conversation_participants cp2
    ON cp2.conversation_id = cp.conversation_id AND cp2.user_id = _other_user_id
  WHERE cp.user_id = _me
  LIMIT 1;

  IF _conv IS NOT NULL THEN RETURN _conv; END IF;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO _conv;
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_conv, _me), (_conv, _other_user_id);

  RETURN _conv;
END;
$$;

REVOKE ALL ON FUNCTION public.start_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid) TO authenticated;