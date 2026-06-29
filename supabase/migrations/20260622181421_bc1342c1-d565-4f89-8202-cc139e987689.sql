CREATE OR REPLACE FUNCTION public.get_following_feed(limit_count integer, cursor timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, comments_count integer, reposts_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, preview_text text, preview_title text, preview_image_url text, is_public boolean, profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text, is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH seen_ids AS (
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
      AND (cursor IS NULL OR p.created_at < cursor)
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
      AND (cursor IS NULL OR r.created_at < cursor)
  )
  SELECT id, user_id, content, created_at, likes_count, saves_count, comments_count, reposts_count,
    media_type, media_url, platform, embed_html, thumbnail_url, title,
    preview_text, preview_title, preview_image_url, is_public,
    profile_id, profile_username, profile_display_name, profile_avatar_url,
    is_repost, reposted_by_user_id, reposted_by_username, sort_time as reposted_at
  FROM following_posts
  ORDER BY date_trunc('minute', sort_time) DESC,
           hashtext(id::text) DESC,
           id DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;

REVOKE EXECUTE ON FUNCTION public.get_following_feed(integer, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_following_feed(integer, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_following_feed(integer, timestamp with time zone) TO service_role;

GRANT SELECT, INSERT, DELETE ON public.post_seen TO authenticated;
GRANT ALL ON public.post_seen TO service_role;