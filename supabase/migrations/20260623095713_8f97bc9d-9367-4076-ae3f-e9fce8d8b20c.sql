DROP FUNCTION IF EXISTS public.get_following_feed(integer, timestamptz);

CREATE OR REPLACE FUNCTION public.get_following_feed(
  limit_count integer,
  cursor timestamptz DEFAULT NULL
)
RETURNS TABLE(
  id uuid, user_id uuid, content text, created_at timestamptz,
  likes_count integer, saves_count integer, comments_count integer, reposts_count integer,
  media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text,
  preview_text text, preview_title text, preview_image_url text, is_public boolean,
  media_kind text, aspect_ratio numeric, suggested_height integer,
  profile_username text, profile_display_name text, profile_avatar_url text,
  is_repost boolean, reposted_by_user_id uuid, reposted_by_username text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH seen_ids AS (
    SELECT post_id FROM public.post_seen WHERE user_id = auth.uid()
  ),
  hidden_post_ids AS (
    SELECT post_id FROM public.hidden_posts WHERE user_id = auth.uid()
  ),
  hidden_user_ids AS (
    SELECT hidden_user_id FROM public.hidden_users WHERE user_id = auth.uid()
  ),
  candidates AS (
    SELECT
      p.id, p.user_id, p.content, p.created_at,
      p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      p.media_kind, p.aspect_ratio, p.suggested_height,
      pr.username AS profile_username,
      pr.display_name AS profile_display_name,
      pr.avatar_url AS profile_avatar_url,
      false AS is_repost,
      NULL::uuid AS reposted_by_user_id,
      NULL::text AS reposted_by_username,
      p.created_at AS sort_time
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.is_public = true
      AND (
        p.user_id = auth.uid()
        OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
      )
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND p.id NOT IN (SELECT post_id FROM seen_ids)
    UNION ALL
    SELECT
      p.id, p.user_id, p.content, p.created_at,
      p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      p.media_kind, p.aspect_ratio, p.suggested_height,
      pr.username AS profile_username,
      pr.display_name AS profile_display_name,
      pr.avatar_url AS profile_avatar_url,
      true AS is_repost,
      r.user_id AS reposted_by_user_id,
      pr_re.username AS reposted_by_username,
      r.created_at AS sort_time
    FROM public.reposts r
    INNER JOIN public.posts p ON p.id = r.post_id
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    LEFT JOIN public.profiles pr_re ON pr_re.user_id = r.user_id
    WHERE p.is_public = true
      AND (
        r.user_id = auth.uid()
        OR r.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
      )
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND r.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND p.id NOT IN (SELECT post_id FROM seen_ids)
  )
  SELECT
    c.id, c.user_id, c.content, c.created_at,
    c.likes_count, c.saves_count, c.comments_count, c.reposts_count,
    c.media_type, c.media_url, c.platform, c.embed_html, c.thumbnail_url, c.title,
    c.preview_text, c.preview_title, c.preview_image_url, c.is_public,
    c.media_kind, c.aspect_ratio, c.suggested_height,
    c.profile_username, c.profile_display_name, c.profile_avatar_url,
    c.is_repost, c.reposted_by_user_id, c.reposted_by_username
  FROM candidates c
  WHERE (cursor IS NULL OR c.sort_time < cursor)
  ORDER BY date_trunc('minute', c.sort_time) DESC, hashtext(c.id::text) DESC, c.id DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;

REVOKE EXECUTE ON FUNCTION public.get_following_feed(integer, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_following_feed(integer, timestamptz) TO authenticated, service_role;

GRANT SELECT, INSERT, DELETE ON public.post_seen TO authenticated;
GRANT ALL ON public.post_seen TO service_role;