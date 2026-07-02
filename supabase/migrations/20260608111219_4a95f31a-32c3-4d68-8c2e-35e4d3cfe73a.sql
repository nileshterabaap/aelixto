
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_kind text,
  ADD COLUMN IF NOT EXISTS aspect_ratio numeric,
  ADD COLUMN IF NOT EXISTS suggested_height integer;

DROP FUNCTION IF EXISTS public.get_following_feed_v2(integer, text);

CREATE OR REPLACE FUNCTION public.get_following_feed_v2(limit_count integer, cursor_key text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, comments_count integer, reposts_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, preview_text text, preview_title text, preview_image_url text, is_public boolean, media_kind text, aspect_ratio numeric, suggested_height integer, profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text, is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamp with time zone, feed_cursor text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cursor_values AS (
    SELECT
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'tier')::int END AS c_tier,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'sort_time')::timestamptz END AS c_sort_time,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'id')::uuid END AS c_id
  ),
  hidden_post_ids AS (
    SELECT post_id FROM public.hidden_posts WHERE user_id = auth.uid()
  ),
  hidden_user_ids AS (
    SELECT hidden_user_id FROM public.hidden_users WHERE user_id = auth.uid()
  ),
  new_follows AS (
    SELECT following_id
    FROM public.follows
    WHERE follower_id = auth.uid()
      AND created_at > now() - interval '7 days'
  ),
  eligible_posts AS (
    SELECT
      p.id, p.user_id, p.content, p.created_at,
      p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      p.media_kind, p.aspect_ratio, p.suggested_height,
      pr.id as profile_id, pr.username as profile_username,
      pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
      false as is_repost, NULL::uuid as reposted_by_user_id, NULL::text as reposted_by_username,
      p.created_at as sort_time,
      (p.user_id IN (SELECT following_id FROM new_follows)) as from_new_follow
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
      p.media_kind, p.aspect_ratio, p.suggested_height,
      pr.id as profile_id, pr.username as profile_username,
      pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
      true as is_repost, r.user_id as reposted_by_user_id, pr_reposter.username as reposted_by_username,
      r.created_at as sort_time,
      (r.user_id IN (SELECT following_id FROM new_follows)) as from_new_follow
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
    SELECT *,
      CASE
        WHEN sort_time > now() - interval '24 hours' THEN 1
        WHEN from_new_follow THEN 2
        ELSE 3
      END AS tier
    FROM eligible_posts
  )
  SELECT t.id, t.user_id, t.content, t.created_at, t.likes_count, t.saves_count,
         t.comments_count, t.reposts_count, t.media_type, t.media_url, t.platform,
         t.embed_html, t.thumbnail_url, t.title, t.preview_text, t.preview_title,
         t.preview_image_url, t.is_public,
         t.media_kind, t.aspect_ratio, t.suggested_height,
         t.profile_id, t.profile_username,
         t.profile_display_name, t.profile_avatar_url, t.is_repost,
         t.reposted_by_user_id, t.reposted_by_username, t.sort_time as reposted_at,
         jsonb_build_object(
           'tier', t.tier,
           'sort_time', t.sort_time,
           'id', t.id
         )::text AS feed_cursor
  FROM tiered t
  CROSS JOIN cursor_values cv
  WHERE (
    cursor_key IS NULL
    OR t.tier > cv.c_tier
    OR (t.tier = cv.c_tier AND t.sort_time < cv.c_sort_time)
    OR (t.tier = cv.c_tier AND t.sort_time = cv.c_sort_time AND t.id < cv.c_id)
  )
  ORDER BY t.tier ASC, t.sort_time DESC, t.id DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;
