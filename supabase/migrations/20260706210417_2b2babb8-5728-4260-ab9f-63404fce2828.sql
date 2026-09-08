CREATE OR REPLACE FUNCTION public.can_view_profile_posts(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    _target IS NOT NULL
    AND (
      auth.uid() = _target
      OR (
        NOT public.are_blocked(auth.uid(), _target)
        AND (
          NOT COALESCE(((SELECT p.settings FROM public.profiles p WHERE p.user_id = _target) ->> 'is_private')::boolean, false)
          OR EXISTS (
            SELECT 1
            FROM public.follows f
            WHERE f.follower_id = auth.uid()
              AND f.following_id = _target
          )
        )
      )
    ),
    false
  )
$function$;

GRANT EXECUTE ON FUNCTION public.can_view_profile_posts(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_platform_counts(target_user uuid)
RETURNS TABLE(platform text, post_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH combined AS (
    SELECT p.id, p.platform
    FROM public.posts p
    WHERE p.user_id = target_user
      AND p.is_public = true
      AND p.platform IS NOT NULL
      AND p.platform <> ''
      AND public.can_view_profile_posts(target_user)
      AND public.can_view_profile_posts(p.user_id)
    UNION
    SELECT p.id, p.platform
    FROM public.reposts r
    JOIN public.posts p ON p.id = r.post_id
    WHERE r.user_id = target_user
      AND p.is_public = true
      AND p.platform IS NOT NULL
      AND p.platform <> ''
      AND public.can_view_profile_posts(target_user)
      AND public.can_view_profile_posts(p.user_id)
      AND NOT public.are_blocked(auth.uid(), r.user_id)
      AND NOT public.are_blocked(auth.uid(), p.user_id)
  )
  SELECT c.platform, COUNT(*)::int AS post_count
  FROM combined c
  GROUP BY c.platform
  ORDER BY
    CASE WHEN c.platform = 'external' THEN 2
         WHEN c.platform = 'article' THEN 1 ELSE 0 END,
    post_count DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_platform_counts(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_platform_posts(
  target_user uuid,
  platform_name text,
  limit_count integer,
  cursor timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  content text,
  created_at timestamp with time zone,
  likes_count integer,
  saves_count integer,
  media_type text,
  media_url text,
  platform text,
  embed_html text,
  thumbnail_url text,
  title text,
  is_public boolean,
  is_repost boolean,
  original_user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.user_id,
    p.content,
    COALESCE(r.created_at, p.created_at) AS created_at,
    p.likes_count,
    p.saves_count,
    p.media_type,
    p.media_url,
    p.platform,
    p.embed_html,
    p.thumbnail_url,
    p.title,
    p.is_public,
    (r.id IS NOT NULL) AS is_repost,
    CASE WHEN r.id IS NOT NULL THEN p.user_id ELSE NULL END AS original_user_id
  FROM public.posts p
  LEFT JOIN public.reposts r ON r.post_id = p.id AND r.user_id = target_user
  WHERE p.is_public = true
    AND p.platform = platform_name
    AND (p.user_id = target_user OR r.user_id = target_user)
    AND public.can_view_profile_posts(target_user)
    AND public.can_view_profile_posts(p.user_id)
    AND NOT public.are_blocked(auth.uid(), target_user)
    AND NOT public.are_blocked(auth.uid(), p.user_id)
    AND (cursor IS NULL OR COALESCE(r.created_at, p.created_at) < cursor)
  ORDER BY COALESCE(r.created_at, p.created_at) DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_platform_posts(uuid, text, integer, timestamp with time zone) TO anon, authenticated, service_role;