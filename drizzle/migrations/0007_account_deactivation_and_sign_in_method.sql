-- Account deactivation: a deactivated account is hidden from everyone else
-- (profile, posts, likes, comments, follows, chats) until its owner signs in again.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_profiles_deactivated ON public.profiles (user_id) WHERE deactivated_at IS NOT NULL;

-- Deactivated profiles are visible only to their owner.
DROP POLICY IF EXISTS "Profiles publicly viewable" ON public.profiles;
CREATE POLICY "Profiles viewable unless deactivated" ON public.profiles
  FOR SELECT USING (deactivated_at IS NULL OR auth.uid() = user_id);

-- Every existing block check also hides deactivated accounts.
CREATE OR REPLACE FUNCTION public.are_blocked(_a uuid, _b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_a IS NOT NULL AND _b IS NOT NULL AND _a <> _b AND (
    EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.user_id = _a AND b.blocked_user_id = _b)
         OR (b.user_id = _b AND b.blocked_user_id = _a)
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id IN (_a, _b) AND p.deactivated_at IS NOT NULL
    )
  ), false)
$function$;

CREATE OR REPLACE FUNCTION public.deactivate_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.profiles SET deactivated_at = now() WHERE user_id = auth.uid();
END;
$function$;

CREATE OR REPLACE FUNCTION public.reactivate_my_account()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.profiles SET deactivated_at = NULL
  WHERE user_id = auth.uid() AND deactivated_at IS NOT NULL;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.deactivate_my_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_my_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_my_account() TO authenticated;

-- Sign-in help: tells the sign-in screen whether an email has no account,
-- a password account, or a Google/Apple-only account, so the error can say
-- exactly what is wrong.
CREATE OR REPLACE FUNCTION public.get_sign_in_method(_email text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT CASE
      WHEN COALESCE(u.encrypted_password, '') <> '' THEN 'password'
      ELSE 'social'
    END
    FROM auth.users u
    WHERE lower(u.email) = lower(trim(_email))
    LIMIT 1
  ), 'none')
$function$;

REVOKE ALL ON FUNCTION public.get_sign_in_method(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sign_in_method(text) TO anon, authenticated;

-- Home feed and its "new posts" check skip deactivated accounts.
CREATE OR REPLACE FUNCTION public.get_following_feed_v3(limit_count integer, cursor_key text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, comments_count integer, reposts_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, preview_text text, preview_title text, preview_image_url text, is_public boolean, media_kind text, aspect_ratio numeric, suggested_height integer, profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text, is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamp with time zone, feed_cursor text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cursor_values AS (
    SELECT
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'tier')::integer END AS c_tier,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'cluster_rank')::integer END AS c_cluster_rank,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'group_shuffle')::integer END AS c_group_shuffle,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'sort_time')::timestamptz END AS c_sort_time,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE (cursor_key::jsonb->>'id')::uuid END AS c_id
  ),
  hidden_post_ids AS (SELECT post_id FROM public.hidden_posts WHERE user_id = auth.uid()),
  hidden_user_ids AS (SELECT hidden_user_id FROM public.hidden_users WHERE user_id = auth.uid()),
  blocked_ids AS (
    SELECT blocked_user_id AS uid FROM public.blocked_users WHERE user_id = auth.uid()
    UNION
    SELECT user_id AS uid FROM public.blocked_users WHERE blocked_user_id = auth.uid()
    UNION
    SELECT user_id AS uid FROM public.profiles WHERE deactivated_at IS NOT NULL AND user_id <> auth.uid()
  ),
  eligible_posts AS (
    SELECT p.id, p.user_id, p.content, p.created_at, p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public, p.media_kind, p.aspect_ratio, p.suggested_height,
      pr.id AS profile_id, pr.username AS profile_username, pr.display_name AS profile_display_name, pr.avatar_url AS profile_avatar_url,
      false AS is_repost, NULL::uuid AS reposted_by_user_id, NULL::text AS reposted_by_username,
      p.created_at AS sort_time, p.user_id AS actor_user_id
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.is_public = true
      AND (p.user_id = auth.uid() OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()))
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND p.user_id NOT IN (SELECT uid FROM blocked_ids)
      AND NOT EXISTS (SELECT 1 FROM public.post_seen s WHERE s.user_id = auth.uid() AND s.post_id = p.id)
    UNION ALL
    SELECT p.id, p.user_id, p.content, p.created_at, p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public, p.media_kind, p.aspect_ratio, p.suggested_height,
      pr.id AS profile_id, pr.username AS profile_username, pr.display_name AS profile_display_name, pr.avatar_url AS profile_avatar_url,
      true AS is_repost, r.user_id AS reposted_by_user_id, pr_reposter.username AS reposted_by_username,
      r.created_at AS sort_time, r.user_id AS actor_user_id
    FROM public.reposts r
    INNER JOIN public.posts p ON p.id = r.post_id
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    LEFT JOIN public.profiles pr_reposter ON pr_reposter.user_id = r.user_id
    WHERE p.is_public = true
      AND (r.user_id = auth.uid() OR r.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()))
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND r.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND p.user_id NOT IN (SELECT uid FROM blocked_ids)
      AND r.user_id NOT IN (SELECT uid FROM blocked_ids)
      AND NOT EXISTS (SELECT 1 FROM public.post_seen s WHERE s.user_id = auth.uid() AND s.post_id = p.id)
  ),
  tiered AS (
    SELECT e.*,
      CASE WHEN e.sort_time > now() - interval '1 hour' THEN 0
           WHEN e.sort_time > now() - interval '6 hours' THEN 1
           WHEN e.sort_time > now() - interval '1 day' THEN 2
           WHEN e.sort_time > now() - interval '3 days' THEN 3
           WHEN e.sort_time > now() - interval '7 days' THEN 4
           ELSE 5 END AS tier,
      hashtext(coalesce(auth.uid()::text, '') || ':' || e.actor_user_id::text || ':' || coalesce(e.platform, '')) AS group_shuffle
    FROM eligible_posts e
  ),
  ranked AS (
    SELECT t.*,
      row_number() OVER (PARTITION BY t.tier, t.actor_user_id, coalesce(t.platform, '')
                         ORDER BY t.sort_time DESC, t.id DESC) AS cluster_rank
    FROM tiered t
  )
  SELECT r.id, r.user_id, r.content, r.created_at, r.likes_count, r.saves_count, r.comments_count, r.reposts_count,
    r.media_type, r.media_url, r.platform, r.embed_html, r.thumbnail_url, r.title, r.preview_text, r.preview_title,
    r.preview_image_url, r.is_public, r.media_kind, r.aspect_ratio, r.suggested_height,
    r.profile_id, r.profile_username, r.profile_display_name, r.profile_avatar_url,
    r.is_repost, r.reposted_by_user_id, r.reposted_by_username, r.sort_time AS reposted_at,
    jsonb_build_object('tier', r.tier, 'cluster_rank', r.cluster_rank, 'group_shuffle', r.group_shuffle,
                       'sort_time', r.sort_time, 'id', r.id)::text AS feed_cursor
  FROM ranked r CROSS JOIN cursor_values cv
  WHERE cursor_key IS NULL
    OR r.tier > cv.c_tier
    OR (r.tier = cv.c_tier AND r.cluster_rank > cv.c_cluster_rank)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_cluster_rank AND r.group_shuffle < cv.c_group_shuffle)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_cluster_rank AND r.group_shuffle = cv.c_group_shuffle AND r.sort_time < cv.c_sort_time)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_cluster_rank AND r.group_shuffle = cv.c_group_shuffle AND r.sort_time = cv.c_sort_time AND r.id < cv.c_id)
  ORDER BY r.tier ASC, r.cluster_rank ASC, r.group_shuffle DESC, r.sort_time DESC, r.id DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;

CREATE OR REPLACE FUNCTION public.has_unseen_following_feed_posts()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH hidden_post_ids AS (SELECT post_id FROM public.hidden_posts WHERE user_id = auth.uid()),
       hidden_user_ids AS (SELECT hidden_user_id FROM public.hidden_users WHERE user_id = auth.uid()),
       blocked_ids AS (
         SELECT blocked_user_id AS uid FROM public.blocked_users WHERE user_id = auth.uid()
         UNION
         SELECT user_id AS uid FROM public.blocked_users WHERE blocked_user_id = auth.uid()
         UNION
         SELECT user_id AS uid FROM public.profiles WHERE deactivated_at IS NOT NULL AND user_id <> auth.uid()
       )
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.is_public = true
      AND (p.user_id = auth.uid() OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()))
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND p.user_id NOT IN (SELECT uid FROM blocked_ids)
      AND NOT EXISTS (SELECT 1 FROM public.post_seen s WHERE s.user_id = auth.uid() AND s.post_id = p.id)
    UNION ALL
    SELECT 1 FROM public.reposts r
    INNER JOIN public.posts p ON p.id = r.post_id
    WHERE p.is_public = true
      AND (r.user_id = auth.uid() OR r.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()))
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND r.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND p.user_id NOT IN (SELECT uid FROM blocked_ids)
      AND r.user_id NOT IN (SELECT uid FROM blocked_ids)
      AND NOT EXISTS (SELECT 1 FROM public.post_seen s WHERE s.user_id = auth.uid() AND s.post_id = p.id)
    LIMIT 1
  );
$function$;