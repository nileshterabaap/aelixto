
CREATE OR REPLACE FUNCTION public.post_delete_score_preview(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created timestamptz;
  v_within boolean;
  v_points integer := 0;
BEGIN
  SELECT created_at INTO v_created
  FROM public.posts
  WHERE id = p_post_id AND user_id = auth.uid();

  IF v_created IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'points', 0);
  END IF;

  v_within := (v_created AT TIME ZONE 'America/Los_Angeles')::date
              = (now() AT TIME ZONE 'America/Los_Angeles')::date;

  IF v_within THEN
    SELECT count(*) INTO v_points FROM public.post_views WHERE post_id = p_post_id;
  END IF;

  RETURN jsonb_build_object('eligible', v_within AND v_points > 0, 'points', v_points);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_post_with_score(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_created timestamptz;
  v_within boolean;
  v_points integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the row: concurrent deletes serialize here, and the second caller
  -- finds no row, so a deduction can never be applied twice.
  SELECT created_at INTO v_created
  FROM public.posts
  WHERE id = p_post_id AND user_id = v_uid
  FOR UPDATE;

  IF v_created IS NULL THEN
    RAISE EXCEPTION 'Post not found or not owned';
  END IF;

  v_within := (v_created AT TIME ZONE 'America/Los_Angeles')::date
              = (now() AT TIME ZONE 'America/Los_Angeles')::date;

  IF v_within THEN
    SELECT count(*) INTO v_points FROM public.post_views WHERE post_id = p_post_id;
  END IF;

  DELETE FROM public.posts WHERE id = p_post_id AND user_id = v_uid;

  IF v_points > 0 THEN
    UPDATE public.profiles
       SET aelix_score = GREATEST(0, COALESCE(aelix_score, 0) - v_points),
           updated_at = now()
     WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'deleted', true,
    'created_at', v_created,
    'within_cycle', v_within,
    'deducted', v_points
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_delete_score_preview(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_post_with_score(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_delete_score_preview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_post_with_score(uuid) TO authenticated;
