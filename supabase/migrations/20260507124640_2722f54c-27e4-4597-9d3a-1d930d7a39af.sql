CREATE OR REPLACE FUNCTION public.get_following_feed_v2(limit_count integer, cursor_key text DEFAULT NULL::text)
RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, comments_count integer, reposts_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, preview_text text, preview_title text, preview_image_url text, is_public boolean, profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text, is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamp with time zone, feed_cursor text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cursor_values AS (
    SELECT
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'minute_bucket')::timestamp with time zone END AS minute_bucket,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'cluster_rank')::integer END AS cluster_rank,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'shuffle_key')::integer END AS shuffle_key,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'sort_time')::timestamp with time zone END AS sort_time,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'id')::uuid END AS id
  ),
  seen_ids AS (
    SELECT post_id FROM post_seen WHERE user_id = auth.uid()
  ),
  hidden_post_ids AS (
    SELECT post_id FROM hidden_posts WHERE user_id = auth.uid()
  ),
  hidden_user_ids AS (
    SELECT hidden_user_id FROM hidden_users WHERE user_id = auth.uid()
  ),
  following_posts AS (
    SELECT 
      p.id, p.user_id, p.content, p.created_at,
      p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      pr.id as profile_id, pr.username as profile_username,
      pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
      false as is_repost, NULL::uuid as reposted_by_user_id, NULL::text as reposted_by_username,
      p.created_at as sort_time
    FROM posts p
    LEFT JOIN profiles pr ON pr.user_id = p.user_id
    WHERE p.is_public = true
      AND (
        p.user_id = auth.uid()
        OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = auth.uid())
      )
      AND p.id NOT IN (SELECT post_id FROM seen_ids)
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
      r.created_at as sort_time
    FROM reposts r
    INNER JOIN posts p ON p.id = r.post_id
    LEFT JOIN profiles pr ON pr.user_id = p.user_id
    LEFT JOIN profiles pr_reposter ON pr_reposter.user_id = r.user_id
    WHERE p.is_public = true
      AND (
        r.user_id = auth.uid()
        OR r.user_id IN (SELECT following_id FROM follows WHERE follower_id = auth.uid())
      )
      AND p.id NOT IN (SELECT post_id FROM seen_ids)
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND r.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
  ),
  ranked_posts AS (
    SELECT *,
      date_trunc('minute', sort_time) AS minute_bucket,
      row_number() OVER (
        PARTITION BY date_trunc('minute', sort_time), user_id, COALESCE(platform, '')
        ORDER BY sort_time DESC, id DESC
      ) as cluster_rank,
      hashtext(user_id::text || ':' || COALESCE(platform, '')) AS shuffle_key
    FROM following_posts
  )
  SELECT rp.id, rp.user_id, rp.content, rp.created_at, rp.likes_count, rp.saves_count, rp.comments_count, rp.reposts_count,
    rp.media_type, rp.media_url, rp.platform, rp.embed_html, rp.thumbnail_url, rp.title,
    rp.preview_text, rp.preview_title, rp.preview_image_url, rp.is_public,
    rp.profile_id, rp.profile_username, rp.profile_display_name, rp.profile_avatar_url,
    rp.is_repost, rp.reposted_by_user_id, rp.reposted_by_username, rp.sort_time as reposted_at,
    jsonb_build_object(
      'minute_bucket', rp.minute_bucket,
      'cluster_rank', rp.cluster_rank,
      'shuffle_key', rp.shuffle_key,
      'sort_time', rp.sort_time,
      'id', rp.id
    )::text AS feed_cursor
  FROM ranked_posts rp
  CROSS JOIN cursor_values cv
  WHERE cursor_key IS NULL
    OR rp.minute_bucket < cv.minute_bucket
    OR (rp.minute_bucket = cv.minute_bucket AND rp.cluster_rank > cv.cluster_rank)
    OR (rp.minute_bucket = cv.minute_bucket AND rp.cluster_rank = cv.cluster_rank AND rp.shuffle_key < cv.shuffle_key)
    OR (rp.minute_bucket = cv.minute_bucket AND rp.cluster_rank = cv.cluster_rank AND rp.shuffle_key = cv.shuffle_key AND rp.sort_time < cv.sort_time)
    OR (rp.minute_bucket = cv.minute_bucket AND rp.cluster_rank = cv.cluster_rank AND rp.shuffle_key = cv.shuffle_key AND rp.sort_time = cv.sort_time AND rp.id < cv.id)
  ORDER BY rp.minute_bucket DESC,
           rp.cluster_rank ASC,
           rp.shuffle_key DESC,
           rp.sort_time DESC,
           rp.id DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;