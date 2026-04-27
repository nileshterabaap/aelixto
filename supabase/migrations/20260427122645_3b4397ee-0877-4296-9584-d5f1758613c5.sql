CREATE OR REPLACE FUNCTION public.get_user_platform_counts(target_user uuid)
 RETURNS TABLE(platform text, post_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH combined AS (
    -- Own posts
    SELECT p.id, p.platform
    FROM posts p
    WHERE p.user_id = target_user
      AND p.is_public = true
      AND p.platform IS NOT NULL
      AND p.platform != ''
    UNION
    -- Reposts (count the original post's platform)
    SELECT p.id, p.platform
    FROM reposts r
    JOIN posts p ON p.id = r.post_id
    WHERE r.user_id = target_user
      AND p.is_public = true
      AND p.platform IS NOT NULL
      AND p.platform != ''
  )
  SELECT c.platform, COUNT(*)::int AS post_count
  FROM combined c
  GROUP BY c.platform
  ORDER BY
    CASE
      WHEN c.platform = 'external' THEN 2
      WHEN c.platform = 'article' THEN 1
      ELSE 0
    END,
    post_count DESC;
$function$;