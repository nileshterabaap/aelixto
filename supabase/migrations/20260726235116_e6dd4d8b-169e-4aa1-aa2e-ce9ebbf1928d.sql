CREATE OR REPLACE FUNCTION public.delete_conversation(_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _uid
  ) THEN
    RETURN false;
  END IF;

  DELETE FROM public.messages WHERE conversation_id = _conversation_id;
  DELETE FROM public.conversation_participants WHERE conversation_id = _conversation_id;
  DELETE FROM public.conversations WHERE id = _conversation_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_conversation(uuid) TO authenticated;