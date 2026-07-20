
CREATE OR REPLACE FUNCTION public.refresh_following_feed_v2(
  limit_count integer,
  seen_post_ids uuid[] DEFAULT ARRAY[]::uuid[],
  since_time timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid, user_id uuid, content text, created_at timestamptz,
  likes_count integer, saves_count integer, comments_count integer, reposts_count integer,
  media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text,
  preview_text text, preview_title text, preview_image_url text, is_public boolean,
  media_kind text, aspect_ratio numeric, suggested_height integer,
  profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text,
  is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamptz,
  feed_cursor text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  cap int := GREATEST(1, LEAST(limit_count, 50));
  newer_count int := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Mark the posts the client says are currently visible/seen
  INSERT INTO public.post_seen (user_id, post_id)
  SELECT current_user_id, unnest_post_id
  FROM unnest(COALESCE(seen_post_ids, ARRAY[]::uuid[])) AS unnest_post_id
  WHERE unnest_post_id IS NOT NULL
  ON CONFLICT (user_id, post_id) DO NOTHING;

  -- Step 1: return posts strictly newer than the client's current top item.
  -- Bypass the post_seen filter for these so a freshly-marked "newer post
  -- created since I loaded the feed" is never hidden by the seen logic.
  IF since_time IS NOT NULL THEN
    RETURN QUERY
    WITH hidden_post_ids AS (
      SELECT post_id FROM public.hidden_posts WHERE user_id = current_user_id
    ),
    hidden_user_ids AS (
      SELECT hidden_user_id FROM public.hidden_users WHERE user_id = current_user_id
    ),
    eligible AS (
      SELECT
        p.id, p.user_id, p.content, p.created_at,
        p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
        p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
        p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
        p.media_kind, p.aspect_ratio, p.suggested_height,
        pr.id as profile_id, pr.username as profile_username,
        pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
        false as is_repost, NULL::uuid as reposted_by_user_id, NULL::text as reposted_by_username,
        p.created_at as sort_time
      FROM public.posts p
      LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
      WHERE p.is_public = true
        AND p.created_at > since_time
        AND (
          p.user_id = current_user_id
          OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = current_user_id)
        )
        AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
        AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      UNION ALL
      SELECT
        p.id, p.user_id, p.content, p.created_at,
        p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
        p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
        p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
        p.media_kind, p.aspect_ratio, p.suggested_height,
        pr.id as profile_id, pr.username as profile_username,
        pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
        true as is_repost, r.user_id as reposted_by_user_id, pr_reposter.username as reposted_by_username,
        r.created_at as sort_time
      FROM public.reposts r
      INNER JOIN public.posts p ON p.id = r.post_id
      LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
      LEFT JOIN public.profiles pr_reposter ON pr_reposter.user_id = r.user_id
      WHERE p.is_public = true
        AND r.created_at > since_time
        AND (
          r.user_id = current_user_id
          OR r.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = current_user_id)
        )
        AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
        AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
        AND r.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
    )
    SELECT e.id, e.user_id, e.content, e.created_at,
           e.likes_count, e.saves_count, e.comments_count, e.reposts_count,
           e.media_type, e.media_url, e.platform, e.embed_html, e.thumbnail_url, e.title,
           e.preview_text, e.preview_title, e.preview_image_url, e.is_public,
           e.media_kind, e.aspect_ratio, e.suggested_height,
           e.profile_id, e.profile_username, e.profile_display_name, e.profile_avatar_url,
           e.is_repost, e.reposted_by_user_id, e.reposted_by_username, e.sort_time as reposted_at,
           jsonb_build_object(
             'bucket', date_trunc('hour', e.sort_time),
             'rank', 1,
             'sort_time', e.sort_time,
             'id', e.id
           )::text AS feed_cursor
    FROM eligible e
    ORDER BY e.sort_time DESC, e.id DESC
    LIMIT cap;

    GET DIAGNOSTICS newer_count = ROW_COUNT;

    IF newer_count >= cap THEN
      RETURN;
    END IF;
  END IF;

  -- Step 2: fill remaining slots with the standard unseen feed page.
  RETURN QUERY
  SELECT *
  FROM public.get_following_feed_v2(cap - newer_count, NULL::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_following_feed_v2(integer, uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_following_feed_v2(integer, uuid[], timestamptz) TO service_role;
