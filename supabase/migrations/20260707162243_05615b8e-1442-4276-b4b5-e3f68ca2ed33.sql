
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS hide_counts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comments_disabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS posts_user_platform_pinned_idx
  ON public.posts (user_id, platform, pinned_at DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.enforce_pin_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_pins int;
BEGIN
  IF NEW.pinned_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.pinned_at IS NOT NULL AND OLD.platform = NEW.platform AND OLD.user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO current_pins
    FROM public.posts
    WHERE user_id = NEW.user_id
      AND platform = NEW.platform
      AND pinned_at IS NOT NULL
      AND id <> NEW.id;
  IF current_pins >= 5 THEN
    RAISE EXCEPTION 'PIN_LIMIT_REACHED: max 5 pinned posts per platform';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_enforce_pin_limit ON public.posts;
CREATE TRIGGER posts_enforce_pin_limit
  BEFORE INSERT OR UPDATE OF pinned_at ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pin_limit();

DROP FUNCTION IF EXISTS public.get_user_platform_posts(uuid, text, integer, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.get_user_platform_posts(
  target_user uuid,
  platform_name text,
  limit_count integer,
  cursor timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  id uuid, user_id uuid, content text, created_at timestamp with time zone,
  likes_count integer, saves_count integer, media_type text, media_url text,
  platform text, embed_html text, thumbnail_url text, title text,
  is_public boolean, is_repost boolean, original_user_id uuid,
  pinned_at timestamp with time zone, hide_counts boolean, comments_disabled boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id, p.user_id, p.content,
    COALESCE(r.created_at, p.created_at) AS created_at,
    p.likes_count, p.saves_count, p.media_type, p.media_url, p.platform,
    p.embed_html, p.thumbnail_url, p.title, p.is_public,
    (r.id IS NOT NULL) AS is_repost,
    CASE WHEN r.id IS NOT NULL THEN p.user_id ELSE NULL END AS original_user_id,
    CASE WHEN r.id IS NULL THEN p.pinned_at ELSE NULL END AS pinned_at,
    p.hide_counts,
    p.comments_disabled
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
  ORDER BY
    CASE WHEN r.id IS NULL AND p.pinned_at IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN r.id IS NULL THEN p.pinned_at END DESC NULLS LAST,
    COALESCE(r.created_at, p.created_at) DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;
