
DROP FUNCTION IF EXISTS public.get_following_feed(integer, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_following_feed(
  limit_count integer,
  cursor_key text DEFAULT NULL
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
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cursor_values AS (
    SELECT
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'tier')::integer END AS c_tier,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'cluster_rank')::integer END AS c_cluster_rank,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'group_shuffle')::integer END AS c_group_shuffle,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'sort_time')::timestamptz END AS c_sort_time,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'id')::uuid END AS c_id
  ),
  hidden_post_ids AS (
    SELECT post_id FROM public.hidden_posts WHERE user_id = auth.uid()
  ),
  hidden_user_ids AS (
    SELECT hidden_user_id FROM public.hidden_users WHERE user_id = auth.uid()
  ),
  eligible_posts AS (
    SELECT
      p.id, p.user_id, p.content, p.created_at,
      p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      pr.id AS profile_id, pr.username AS profile_username,
      pr.display_name AS profile_display_name, pr.avatar_url AS profile_avatar_url,
      false AS is_repost, NULL::uuid AS reposted_by_user_id, NULL::text AS reposted_by_username,
      p.created_at AS sort_time,
      p.user_id AS actor_user_id
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.is_public = true
      AND (
        p.user_id = auth.uid()
        OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
      )
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.post_seen s
        WHERE s.user_id = auth.uid() AND s.post_id = p.id
      )
    UNION ALL
    SELECT
      p.id, p.user_id, p.content, p.created_at,
      p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      pr.id AS profile_id, pr.username AS profile_username,
      pr.display_name AS profile_display_name, pr.avatar_url AS profile_avatar_url,
      true AS is_repost, r.user_id AS reposted_by_user_id, pr_reposter.username AS reposted_by_username,
      r.created_at AS sort_time,
      r.user_id AS actor_user_id
    FROM public.reposts r
    INNER JOIN public.posts p ON p.id = r.post_id
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    LEFT JOIN public.profiles pr_reposter ON pr_reposter.user_id = r.user_id
    WHERE p.is_public = true
      AND (
        r.user_id = auth.uid()
        OR r.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
      )
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND r.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.post_seen s
        WHERE s.user_id = auth.uid() AND s.post_id = p.id
      )
  ),
  tiered AS (
    SELECT
      e.*,
      CASE
        WHEN e.sort_time > now() - interval '1 hour' THEN 0
        WHEN e.sort_time > now() - interval '6 hours' THEN 1
        WHEN e.sort_time > now() - interval '1 day' THEN 2
        WHEN e.sort_time > now() - interval '3 days' THEN 3
        WHEN e.sort_time > now() - interval '7 days' THEN 4
        ELSE 5
      END AS tier,
      hashtext(coalesce(auth.uid()::text, '') || ':' || e.actor_user_id::text || ':' || coalesce(e.platform, '')) AS group_shuffle
    FROM eligible_posts e
  ),
  ranked AS (
    SELECT
      t.*,
      row_number() OVER (
        PARTITION BY t.tier, t.actor_user_id, coalesce(t.platform, '')
        ORDER BY t.sort_time DESC, t.id DESC
      ) AS cluster_rank
    FROM tiered t
  )
  SELECT
    r.id, r.user_id, r.content, r.created_at,
    r.likes_count, r.saves_count, r.comments_count, r.reposts_count,
    r.media_type, r.media_url, r.platform, r.embed_html, r.thumbnail_url, r.title,
    r.preview_text, r.preview_title, r.preview_image_url, r.is_public,
    r.profile_id, r.profile_username, r.profile_display_name, r.profile_avatar_url,
    r.is_repost, r.reposted_by_user_id, r.reposted_by_username, r.sort_time AS reposted_at,
    jsonb_build_object(
      'tier', r.tier,
      'cluster_rank', r.cluster_rank,
      'group_shuffle', r.group_shuffle,
      'sort_time', r.sort_time,
      'id', r.id
    )::text AS feed_cursor
  FROM ranked r
  CROSS JOIN cursor_values cv
  WHERE cursor_key IS NULL
    OR r.tier > cv.c_tier
    OR (r.tier = cv.c_tier AND r.cluster_rank > cv.c_cluster_rank)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_cluster_rank AND r.group_shuffle < cv.c_group_shuffle)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_cluster_rank AND r.group_shuffle = cv.c_group_shuffle AND r.sort_time < cv.c_sort_time)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_cluster_rank AND r.group_shuffle = cv.c_group_shuffle AND r.sort_time = cv.c_sort_time AND r.id < cv.c_id)
  ORDER BY r.tier ASC,
           r.cluster_rank ASC,
           r.group_shuffle DESC,
           r.sort_time DESC,
           r.id DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;

REVOKE EXECUTE ON FUNCTION public.get_following_feed(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_following_feed(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_following_feed(integer, text) TO service_role;

NOTIFY pgrst, 'reload schema';
