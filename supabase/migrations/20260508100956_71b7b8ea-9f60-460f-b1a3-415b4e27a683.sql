CREATE OR REPLACE FUNCTION public.get_following_feed_v2(limit_count integer, cursor_key text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, comments_count integer, reposts_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, preview_text text, preview_title text, preview_image_url text, is_public boolean, profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text, is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamp with time zone, feed_cursor text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cursor_values AS (
    SELECT
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'user_sequence')::integer END AS user_sequence,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'platform_sequence')::integer END AS platform_sequence,
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
  -- Within each (user, platform) cluster, rank newest first
  user_platform_ranked AS (
    SELECT *,
      row_number() OVER (
        PARTITION BY user_id, COALESCE(platform, '')
        ORDER BY sort_time DESC, id DESC
      ) as up_rank
    FROM eligible_posts
  ),
  -- Within each user, alternate platforms (round-robin per author)
  user_sequenced AS (
    SELECT *,
      row_number() OVER (
        PARTITION BY user_id
        ORDER BY up_rank ASC, hashtext(COALESCE(platform, '')) DESC, sort_time DESC, id DESC
      ) as user_sequence,
      hashtext(user_id::text) as author_shuffle
    FROM user_platform_ranked
  ),
  -- Across all users, give every (platform, round) a global stripe position so
  -- the same platform doesn't cluster across users in the same round
  globally_sequenced AS (
    SELECT *,
      row_number() OVER (
        PARTITION BY user_sequence, COALESCE(platform, '')
        ORDER BY author_shuffle DESC, sort_time DESC, id DESC
      ) as platform_sequence
    FROM user_sequenced
  )
  SELECT gs.id, gs.user_id, gs.content, gs.created_at, gs.likes_count, gs.saves_count, gs.comments_count, gs.reposts_count,
    gs.media_type, gs.media_url, gs.platform, gs.embed_html, gs.thumbnail_url, gs.title,
    gs.preview_text, gs.preview_title, gs.preview_image_url, gs.is_public,
    gs.profile_id, gs.profile_username, gs.profile_display_name, gs.profile_avatar_url,
    gs.is_repost, gs.reposted_by_user_id, gs.reposted_by_username, gs.sort_time as reposted_at,
    jsonb_build_object(
      'user_sequence', gs.user_sequence,
      'platform_sequence', gs.platform_sequence,
      'author_shuffle', gs.author_shuffle,
      'sort_time', gs.sort_time,
      'id', gs.id
    )::text AS feed_cursor
  FROM globally_sequenced gs
  CROSS JOIN cursor_values cv
  WHERE gs.is_seen = false
    AND (
      cursor_key IS NULL
      OR gs.user_sequence > cv.user_sequence
      OR (gs.user_sequence = cv.user_sequence AND gs.platform_sequence > cv.platform_sequence)
      OR (gs.user_sequence = cv.user_sequence AND gs.platform_sequence = cv.platform_sequence AND gs.author_shuffle < cv.author_shuffle)
      OR (gs.user_sequence = cv.user_sequence AND gs.platform_sequence = cv.platform_sequence AND gs.author_shuffle = cv.author_shuffle AND gs.sort_time < cv.sort_time)
      OR (gs.user_sequence = cv.user_sequence AND gs.platform_sequence = cv.platform_sequence AND gs.author_shuffle = cv.author_shuffle AND gs.sort_time = cv.sort_time AND gs.id < cv.id)
    )
  -- Order: round-robin by user_sequence, then stripe platforms, then shuffle authors
  ORDER BY gs.user_sequence ASC,
           gs.platform_sequence ASC,
           gs.author_shuffle DESC,
           gs.sort_time DESC,
           gs.id DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;

REVOKE EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) TO authenticated;