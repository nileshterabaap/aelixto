-- Update get_following_feed to return posts with profile data joined
DROP FUNCTION IF EXISTS get_following_feed(int, timestamptz);

CREATE OR REPLACE FUNCTION get_following_feed(limit_count int, cursor timestamptz DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  likes_count int,
  saves_count int,
  media_type text,
  media_url text,
  platform text,
  embed_html text,
  thumbnail_url text,
  title text,
  is_public boolean,
  profile_id uuid,
  profile_username text,
  profile_display_name text,
  profile_avatar_url text
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
    p.created_at,
    p.likes_count,
    p.saves_count,
    p.media_type,
    p.media_url,
    p.platform,
    p.embed_html,
    p.thumbnail_url,
    p.title,
    p.is_public,
    pr.id as profile_id,
    pr.username as profile_username,
    pr.display_name as profile_display_name,
    pr.avatar_url as profile_avatar_url
  FROM posts p
  LEFT JOIN profiles pr ON pr.user_id = p.user_id
  WHERE p.is_public = true
    AND p.user_id IN (
      SELECT following_id FROM follows WHERE follower_id = auth.uid()
    )
    AND (cursor IS NULL OR p.created_at < cursor)
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$$;