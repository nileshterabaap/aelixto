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
      NOT COALESCE(((SELECT p.settings FROM public.profiles p WHERE p.user_id = _target) ->> 'is_private')::boolean, false)
      OR auth.uid() = _target
      OR (
        auth.uid() IS NOT NULL
        AND NOT public.are_blocked(auth.uid(), _target)
        AND EXISTS (
          SELECT 1
          FROM public.follows f
          WHERE f.follower_id = auth.uid()
            AND f.following_id = _target
        )
      )
    )
    AND (
      auth.uid() IS NULL
      OR auth.uid() = _target
      OR NOT public.are_blocked(auth.uid(), _target)
    ),
    false
  )
$function$;

GRANT EXECUTE ON FUNCTION public.can_view_profile_posts(uuid) TO anon, authenticated, service_role;