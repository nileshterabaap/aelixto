CREATE OR REPLACE FUNCTION public.get_following_feed_v2(limit_count integer, cursor_key text DEFAULT NULL::text)
RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, comments_count integer, reposts_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, preview_text text, preview_title text, preview_image_url text, is_public boolean, profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text, is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamp with time zone, feed_cursor text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cursor_values AS (
    SELECT
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'user_sequence')::integer END AS user_sequence,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'author_shuffle')::integer END AS author_shuffle,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'sort_time')::timestamp with time zone END AS sort_time,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'id')::uuid END AS id
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
      pr.id as profile_id, pr.username as profile_username,
      pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
      false as is_repost, NULL::uuid as reposted_by_user_id, NULL::text as reposted_by_username,
      p.created_at as sort_time,
      EXISTS (
        SELECT 1 FROM public.post_seen s
        WHERE s.user_id = auth.uid() AND s.post_id = p.id
      ) as is_seen
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
      pr.id as profile_id, pr.username as profile_username,
      pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
      true as is_repost, r.user_id as reposted_by_user_id, pr_reposter.username as reposted_by_username,
      r.created_at as sort_time,
      EXISTS (
        SELECT 1 FROM public.post_seen s
        WHERE s.user_id = auth.uid() AND s.post_id = p.id
      ) as is_seen
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
  platform_ranked AS (
    SELECT *,
      row_number() OVER (
        PARTITION BY user_id, COALESCE(platform, '')
        ORDER BY sort_time DESC, id DESC
      ) as platform_sequence,
      hashtext(COALESCE(platform, '')) as platform_shuffle
    FROM eligible_posts
  ),
  sequenced_posts AS (
    SELECT *,
      row_number() OVER (
        PARTITION BY user_id
        ORDER BY platform_sequence ASC, platform_shuffle DESC, sort_time DESC, id DESC
      ) as user_sequence,
      hashtext(user_id::text) as author_shuffle
    FROM platform_ranked
  )
  SELECT sp.id, sp.user_id, sp.content, sp.created_at, sp.likes_count, sp.saves_count, sp.comments_count, sp.reposts_count,
    sp.media_type, sp.media_url, sp.platform, sp.embed_html, sp.thumbnail_url, sp.title,
    sp.preview_text, sp.preview_title, sp.preview_image_url, sp.is_public,
    sp.profile_id, sp.profile_username, sp.profile_display_name, sp.profile_avatar_url,
    sp.is_repost, sp.reposted_by_user_id, sp.reposted_by_username, sp.sort_time as reposted_at,
    jsonb_build_object(
      'user_sequence', sp.user_sequence,
      'author_shuffle', sp.author_shuffle,
      'sort_time', sp.sort_time,
      'id', sp.id
    )::text AS feed_cursor
  FROM sequenced_posts sp
  CROSS JOIN cursor_values cv
  WHERE sp.is_seen = false
    AND (
      cursor_key IS NULL
      OR sp.user_sequence > cv.user_sequence
      OR (sp.user_sequence = cv.user_sequence AND sp.author_shuffle < cv.author_shuffle)
      OR (sp.user_sequence = cv.user_sequence AND sp.author_shuffle = cv.author_shuffle AND sp.sort_time < cv.sort_time)
      OR (sp.user_sequence = cv.user_sequence AND sp.author_shuffle = cv.author_shuffle AND sp.sort_time = cv.sort_time AND sp.id < cv.id)
    )
  ORDER BY sp.user_sequence ASC,
           sp.author_shuffle DESC,
           sp.sort_time DESC,
           sp.id DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;

REVOKE EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) TO authenticated;