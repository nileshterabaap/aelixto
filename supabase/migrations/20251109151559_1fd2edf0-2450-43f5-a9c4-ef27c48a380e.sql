-- Update get_user_platform_posts to include reposts
DROP FUNCTION IF EXISTS public.get_user_platform_posts(uuid, text, integer, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_user_platform_posts(
  target_user uuid,
  platform_name text,
  limit_count integer,
  cursor timestamp with time zone DEFAULT NULL
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
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.user_id,
    p.content,
    COALESCE(r.created_at, p.created_at) as created_at,
    p.likes_count,
    p.saves_count,
    p.media_type,
    p.media_url,
    p.platform,
    p.embed_html,
    p.thumbnail_url,
    p.title,
    p.is_public,
    (r.id IS NOT NULL) as is_repost,
    CASE WHEN r.id IS NOT NULL THEN p.user_id ELSE NULL END as original_user_id
  FROM posts p
  LEFT JOIN reposts r ON r.post_id = p.id AND r.user_id = target_user
  WHERE p.is_public = true
    AND p.platform = platform_name
    AND (
      p.user_id = target_user OR r.user_id = target_user
    )
    AND (cursor IS NULL OR COALESCE(r.created_at, p.created_at) < cursor)
  ORDER BY COALESCE(r.created_at, p.created_at) DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$$;