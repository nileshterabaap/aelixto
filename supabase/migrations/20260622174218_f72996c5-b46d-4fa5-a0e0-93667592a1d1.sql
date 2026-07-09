CREATE OR REPLACE FUNCTION public.refresh_following_feed(
  limit_count integer,
  seen_post_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  content text,
  created_at timestamp with time zone,
  likes_count integer,
  saves_count integer,
  comments_count integer,
  reposts_count integer,
  media_type text,
  media_url text,
  platform text,
  embed_html text,
  thumbnail_url text,
  title text,
  preview_text text,
  preview_title text,
  preview_image_url text,
  is_public boolean,
  profile_id uuid,
  profile_username text,
  profile_display_name text,
  profile_avatar_url text,
  is_repost boolean,
  reposted_by_user_id uuid,
  reposted_by_username text,
  reposted_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.post_seen (user_id, post_id)
  SELECT current_user_id, seen_id
  FROM unnest(COALESCE(seen_post_ids, ARRAY[]::uuid[])) AS seen_id
  WHERE seen_id IS NOT NULL
  ON CONFLICT ON CONSTRAINT post_seen_user_id_post_id_key DO NOTHING;

  RETURN QUERY
  SELECT *
  FROM public.get_following_feed(GREATEST(1, LEAST(limit_count, 50)), NULL::timestamp with time zone);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.refresh_following_feed(integer, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_following_feed(integer, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_following_feed(integer, uuid[]) TO service_role;