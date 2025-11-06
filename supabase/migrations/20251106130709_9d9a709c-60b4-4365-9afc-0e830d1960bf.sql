-- Drop and recreate search_profiles function with user_id in return type
DROP FUNCTION IF EXISTS public.search_profiles(text, integer, uuid);

CREATE FUNCTION public.search_profiles(q text, limit_count integer, cursor uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, user_id uuid, username text, display_name text, avatar_url text, is_following boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT p.*
    FROM profiles p
    WHERE
      (lower(p.username) = lower(q))
      OR (p.search_tsv @@ plainto_tsquery('simple', q))
      OR (p.username ILIKE '%'||q||'%')
      OR (p.display_name ILIKE '%'||q||'%')
  ),
  ranked AS (
    SELECT
      b.id, b.user_id, b.username, b.display_name, b.avatar_url,
      EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = b.user_id
      ) AS is_following
    FROM base b
    WHERE (cursor IS NULL OR b.id > cursor)
    ORDER BY
      (lower(b.username) = lower(q)) DESC,
      b.display_name ASC,
      b.username ASC
    LIMIT GREATEST(1, LEAST(limit_count, 50))
  )
  SELECT * FROM ranked;
$$;