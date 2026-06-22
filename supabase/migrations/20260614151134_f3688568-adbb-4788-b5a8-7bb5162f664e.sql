DROP FUNCTION IF EXISTS public.search_profiles(text, integer, uuid);

CREATE FUNCTION public.search_profiles(q text, limit_count integer, cursor uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_following boolean,
  is_requested boolean,
  follows_me boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT p.*
    FROM public.profiles p
    WHERE
      (lower(p.username) = lower(q))
      OR (p.search_tsv @@ plainto_tsquery('simple', q))
      OR (p.username ILIKE '%'||q||'%')
      OR (p.display_name ILIKE '%'||q||'%')
  ),
  ranked AS (
    SELECT
      b.id,
      b.user_id,
      b.username,
      b.display_name,
      b.avatar_url,
      EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = b.user_id
      ) AS is_following,
      EXISTS (
        SELECT 1 FROM public.follow_requests fr
        WHERE fr.requester_id = auth.uid() AND fr.target_id = b.user_id
      ) AS is_requested,
      EXISTS (
        SELECT 1 FROM public.follows f2
        WHERE f2.follower_id = b.user_id AND f2.following_id = auth.uid()
      ) AS follows_me
    FROM base b
    WHERE (cursor IS NULL OR b.id > cursor)
    ORDER BY
      (lower(b.username) = lower(q)) DESC,
      b.display_name ASC,
      b.username ASC
    LIMIT GREATEST(1, LEAST(limit_count, 50))
  )
  SELECT * FROM ranked;
$function$;

GRANT EXECUTE ON FUNCTION public.search_profiles(text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_profiles(text, integer, uuid) TO anon;