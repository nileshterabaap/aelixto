CREATE OR REPLACE FUNCTION public.refresh_following_feed_v3(
  limit_count integer,
  seen_post_ids uuid[] DEFAULT ARRAY[]::uuid[],
  since_time timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
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
  media_kind text,
  aspect_ratio numeric,
  suggested_height integer,
  profile_id uuid,
  profile_username text,
  profile_display_name text,
  profile_avatar_url text,
  is_repost boolean,
  reposted_by_user_id uuid,
  reposted_by_username text,
  reposted_at timestamptz,
  feed_cursor text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  cap int := GREATEST(1, LEAST(limit_count, 50));
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.post_seen (user_id, post_id)
  SELECT current_user_id, unnest_post_id
  FROM unnest(COALESCE(seen_post_ids, ARRAY[]::uuid[])) AS unnest_post_id
  WHERE unnest_post_id IS NOT NULL
  ON CONFLICT ON CONSTRAINT post_seen_user_id_post_id_key DO NOTHING;

  RETURN QUERY
  WITH base AS (
    SELECT
      gf.*,
      row_number() OVER () AS original_position
    FROM public.get_following_feed_v3(cap, NULL::text) gf
  ),
  ordered AS (
    SELECT
      b.*,
      CASE WHEN since_time IS NOT NULL AND b.reposted_at > since_time THEN 0 ELSE 1 END AS refresh_group
    FROM base b
  )
  SELECT
    o.id, o.user_id, o.content, o.created_at,
    o.likes_count, o.saves_count, o.comments_count, o.reposts_count,
    o.media_type, o.media_url, o.platform, o.embed_html, o.thumbnail_url, o.title,
    o.preview_text, o.preview_title, o.preview_image_url, o.is_public,
    o.media_kind, o.aspect_ratio, o.suggested_height,
    o.profile_id, o.profile_username, o.profile_display_name, o.profile_avatar_url,
    o.is_repost, o.reposted_by_user_id, o.reposted_by_username, o.reposted_at,
    o.feed_cursor
  FROM ordered o
  ORDER BY o.refresh_group ASC,
           CASE WHEN o.refresh_group = 0 THEN o.reposted_at END DESC,
           o.original_position ASC
  LIMIT cap;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_following_feed_v3(integer, uuid[], timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_following_feed_v3(integer, uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_following_feed_v3(integer, uuid[], timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';