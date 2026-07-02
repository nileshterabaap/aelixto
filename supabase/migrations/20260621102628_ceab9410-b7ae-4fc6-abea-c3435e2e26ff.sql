CREATE OR REPLACE FUNCTION public.get_following_feed_v2(limit_count integer, cursor_key text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, comments_count integer, reposts_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, preview_text text, preview_title text, preview_image_url text, is_public boolean, media_kind text, aspect_ratio numeric, suggested_height integer, profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text, is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamp with time zone, feed_cursor text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cursor_values AS (
    SELECT
      CASE WHEN cursor_key IS NULL THEN NULL ELSE ((cursor_key::jsonb)->>'tier')::int END AS c_tier,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE ((cursor_key::jsonb)->>'rank')::int END AS c_rank,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE ((cursor_key::jsonb)->>'shuffle')::double precision END AS c_shuffle,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE ((cursor_key::jsonb)->>'id')::uuid END AS c_id
  ),
  hidden_post_ids AS (
    SELECT post_id FROM public.hidden_posts WHERE user_id = auth.uid()
  ),
  hidden_user_ids AS (
    SELECT hidden_user_id FROM public.hidden_users WHERE user_id = auth.uid()
  ),
  candidate_posts AS (
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
      AND (
        p.user_id = auth.uid()
        OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
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
      AND (
        r.user_id = auth.uid()
        OR r.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
      )
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND r.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
  ),
  tiered AS (
    SELECT
      c.*,
      CASE
        WHEN c.sort_time > now() - interval '1 hour'  THEN 0
        WHEN c.sort_time > now() - interval '6 hours' THEN 1
        WHEN c.sort_time > now() - interval '1 day'   THEN 2
        WHEN c.sort_time > now() - interval '3 days'  THEN 3
        WHEN c.sort_time > now() - interval '7 days'  THEN 4
        ELSE 5
      END AS tier,
      (abs(hashtext(coalesce(auth.uid()::text,'') || ':' || c.id::text))::double precision
        / 2147483647.0) AS shuffle_score
    FROM candidate_posts c
  ),
  ranked AS (
    SELECT
      t.*,
      row_number() OVER (
        PARTITION BY t.tier,
                     COALESCE(t.reposted_by_user_id, t.user_id),
                     COALESCE(t.platform, '')
        ORDER BY t.shuffle_score, t.id
      ) AS cluster_rank
    FROM tiered t
  )
  SELECT r.id, r.user_id, r.content, r.created_at, r.likes_count, r.saves_count,
         r.comments_count, r.reposts_count, r.media_type, r.media_url, r.platform,
         r.embed_html, r.thumbnail_url, r.title, r.preview_text, r.preview_title,
         r.preview_image_url, r.is_public,
         r.media_kind, r.aspect_ratio, r.suggested_height,
         r.profile_id, r.profile_username,
         r.profile_display_name, r.profile_avatar_url, r.is_repost,
         r.reposted_by_user_id, r.reposted_by_username, r.sort_time as reposted_at,
         jsonb_build_object(
           'tier', r.tier,
           'rank', r.cluster_rank,
           'shuffle', r.shuffle_score,
           'id', r.id
         )::text AS feed_cursor
  FROM ranked r
  CROSS JOIN cursor_values cv
  WHERE (
    cursor_key IS NULL
    OR r.tier > cv.c_tier
    OR (r.tier = cv.c_tier AND r.cluster_rank > cv.c_rank)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_rank AND r.shuffle_score > cv.c_shuffle)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_rank AND r.shuffle_score = cv.c_shuffle AND r.id > cv.c_id)
  )
    AND NOT EXISTS (
      SELECT 1 FROM public.post_seen s
      WHERE s.user_id = auth.uid() AND s.post_id = r.id
    )
  ORDER BY r.tier ASC, r.cluster_rank ASC, r.shuffle_score ASC, r.id ASC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;

GRANT EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) TO authenticated, service_role;