
-- ============================================================
-- 1. Helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.are_blocked(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(_a IS NOT NULL AND _b IS NOT NULL AND _a <> _b AND EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.user_id = _a AND b.blocked_user_id = _b)
       OR (b.user_id = _b AND b.blocked_user_id = _a)
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.can_view_follow_list(_target uuid, _viewer uuid, _kind text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s jsonb;
  perm text;
BEGIN
  IF _target IS NULL THEN RETURN true; END IF;
  IF _viewer = _target THEN RETURN true; END IF;

  SELECT settings INTO s FROM public.profiles WHERE user_id = _target;
  IF s IS NULL THEN RETURN true; END IF;

  IF _kind = 'followers' THEN
    perm := COALESCE(s->>'who_can_see_followers',
                    CASE WHEN (s->>'is_private')::boolean THEN 'followers' ELSE 'everyone' END);
  ELSE
    perm := COALESCE(s->>'who_can_see_following',
                    CASE WHEN (s->>'is_private')::boolean THEN 'followers' ELSE 'everyone' END);
  END IF;

  IF perm = 'everyone' THEN RETURN true; END IF;
  IF perm = 'no_one'   THEN RETURN false; END IF;
  IF perm = 'followers' THEN
    IF _viewer IS NULL THEN RETURN false; END IF;
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _viewer AND following_id = _target
    );
  END IF;

  RETURN true;
END;
$$;

-- ============================================================
-- 2. profiles — hide when blocked either way
-- ============================================================
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "read all profiles" ON public.profiles;

CREATE POLICY "Profiles viewable unless blocked"
ON public.profiles FOR SELECT
USING (NOT public.are_blocked(auth.uid(), user_id));

-- ============================================================
-- 3. posts — hide when blocked either way
-- ============================================================
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;

CREATE POLICY "Posts viewable unless blocked or private"
ON public.posts FOR SELECT
USING (
  NOT public.are_blocked(auth.uid(), user_id)
  AND (
    -- public posts
    is_public = true
    -- own posts always
    OR user_id = auth.uid()
  )
  AND (
    -- if author has private account, viewer must follow them (or be them)
    user_id = auth.uid()
    OR NOT COALESCE(((SELECT settings FROM public.profiles WHERE user_id = posts.user_id)->>'is_private')::boolean, false)
    OR EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.following_id = posts.user_id
    )
  )
);

-- ============================================================
-- 4. follows — block + follow-list visibility
-- ============================================================
DROP POLICY IF EXISTS "Users can view all follows" ON public.follows;
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;

CREATE POLICY "Follows visible per privacy + block"
ON public.follows FOR SELECT
USING (
  NOT public.are_blocked(auth.uid(), follower_id)
  AND NOT public.are_blocked(auth.uid(), following_id)
  AND (
    -- your own edges always
    auth.uid() = follower_id OR auth.uid() = following_id
    -- someone else's followers: check target's followers visibility
    OR public.can_view_follow_list(following_id, auth.uid(), 'followers')
    -- someone else's following list: check target's following visibility
    OR public.can_view_follow_list(follower_id, auth.uid(), 'following')
  )
);

CREATE POLICY "Users can follow others"
ON public.follows FOR INSERT
WITH CHECK (
  auth.uid() = follower_id
  AND NOT public.are_blocked(follower_id, following_id)
);

-- ============================================================
-- 5. follow_requests — block
-- ============================================================
DROP POLICY IF EXISTS "Requesters create requests" ON public.follow_requests;

CREATE POLICY "Requesters create requests"
ON public.follow_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = requester_id
  AND NOT public.are_blocked(requester_id, target_id)
);

-- ============================================================
-- 6. comments — SELECT visibility + INSERT block/perm
-- ============================================================
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;

CREATE POLICY "Comments viewable unless blocked"
ON public.comments FOR SELECT
USING (NOT public.are_blocked(auth.uid(), user_id));

CREATE POLICY "Users can create comments"
ON public.comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.are_blocked(
    auth.uid(),
    (SELECT p.user_id FROM public.posts p WHERE p.id = comments.post_id)
  )
);

-- ============================================================
-- 7. likes / saves / reposts — block on INSERT & SELECT (where applicable)
-- ============================================================
DROP POLICY IF EXISTS "Users can view all likes" ON public.likes;
DROP POLICY IF EXISTS "Users can create their own likes" ON public.likes;

CREATE POLICY "Likes viewable unless blocked"
ON public.likes FOR SELECT
USING (NOT public.are_blocked(auth.uid(), user_id));

CREATE POLICY "Users can create their own likes"
ON public.likes FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.are_blocked(
    auth.uid(),
    (SELECT p.user_id FROM public.posts p WHERE p.id = likes.post_id)
  )
);

DROP POLICY IF EXISTS "Reposts are viewable by everyone" ON public.reposts;
DROP POLICY IF EXISTS "Users can create reposts" ON public.reposts;

CREATE POLICY "Reposts viewable unless blocked"
ON public.reposts FOR SELECT
USING (
  NOT public.are_blocked(auth.uid(), user_id)
  AND NOT public.are_blocked(
    auth.uid(),
    (SELECT p.user_id FROM public.posts p WHERE p.id = reposts.post_id)
  )
);

CREATE POLICY "Users can create reposts"
ON public.reposts FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.are_blocked(
    auth.uid(),
    (SELECT p.user_id FROM public.posts p WHERE p.id = reposts.post_id)
  )
);

DROP POLICY IF EXISTS "Users can create their own saves" ON public.saves;
CREATE POLICY "Users can create their own saves"
ON public.saves FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.are_blocked(
    auth.uid(),
    (SELECT p.user_id FROM public.posts p WHERE p.id = saves.post_id)
  )
);

-- ============================================================
-- 8. messages / conversation_participants — hard block on new DMs
-- ============================================================
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;

CREATE POLICY "Users can send messages to their conversations"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_participant(conversation_id, auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id <> auth.uid()
      AND public.are_blocked(auth.uid(), cp.user_id)
  )
);

DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;

CREATE POLICY "Users can add participants to conversations"
ON public.conversation_participants FOR INSERT
WITH CHECK (
  -- adding yourself is always ok
  user_id = auth.uid()
  OR (
    -- adding someone else: only if not blocked with you
    NOT public.are_blocked(auth.uid(), user_id)
    AND public.is_conversation_participant(conversation_id, auth.uid())
  )
);

-- ============================================================
-- 9. notifications — no new notifications between blocked pairs
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (
  auth.uid() = recipient_id
  AND (actor_id IS NULL OR NOT public.are_blocked(recipient_id, actor_id))
);

-- ============================================================
-- 10. Auto-cleanup on block: remove follow edges + follow requests
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.user_id AND following_id = NEW.blocked_user_id)
     OR (follower_id = NEW.blocked_user_id AND following_id = NEW.user_id);

  DELETE FROM public.follow_requests
  WHERE (requester_id = NEW.user_id AND target_id = NEW.blocked_user_id)
     OR (requester_id = NEW.blocked_user_id AND target_id = NEW.user_id);

  DELETE FROM public.notifications
  WHERE (recipient_id = NEW.user_id AND actor_id = NEW.blocked_user_id)
     OR (recipient_id = NEW.blocked_user_id AND actor_id = NEW.user_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_on_block ON public.blocked_users;
CREATE TRIGGER trg_cleanup_on_block
AFTER INSERT ON public.blocked_users
FOR EACH ROW EXECUTE FUNCTION public.cleanup_on_block();

-- ============================================================
-- 11. Update SECURITY DEFINER feed + search functions to skip blocked pairs
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_profiles(q text, limit_count integer, cursor uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, user_id uuid, username text, display_name text, avatar_url text, is_following boolean, is_requested boolean, follows_me boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT p.*
    FROM public.profiles p
    WHERE
      (
        (lower(p.username) = lower(q))
        OR (p.search_tsv @@ plainto_tsquery('simple', q))
        OR (p.username ILIKE '%'||q||'%')
        OR (p.display_name ILIKE '%'||q||'%')
      )
      AND NOT public.are_blocked(auth.uid(), p.user_id)
  ),
  ranked AS (
    SELECT
      b.id, b.user_id, b.username, b.display_name, b.avatar_url,
      EXISTS (SELECT 1 FROM public.follows f  WHERE f.follower_id = auth.uid() AND f.following_id = b.user_id) AS is_following,
      EXISTS (SELECT 1 FROM public.follow_requests fr WHERE fr.requester_id = auth.uid() AND fr.target_id = b.user_id) AS is_requested,
      EXISTS (SELECT 1 FROM public.follows f2 WHERE f2.follower_id = b.user_id AND f2.following_id = auth.uid()) AS follows_me
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

-- Feed v2 (add blocked filter)
CREATE OR REPLACE FUNCTION public.get_following_feed_v2(limit_count integer, cursor_key text DEFAULT NULL::text, refresh_seed text DEFAULT ''::text)
RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, comments_count integer, reposts_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, preview_text text, preview_title text, preview_image_url text, is_public boolean, media_kind text, aspect_ratio numeric, suggested_height integer, profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text, is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamp with time zone, feed_cursor text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cursor_values AS (
    SELECT
      CASE WHEN cursor_key IS NULL THEN NULL ELSE ((cursor_key::jsonb)->>'tier')::int END AS c_tier,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE ((cursor_key::jsonb)->>'rank')::int END AS c_rank,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE ((cursor_key::jsonb)->>'shuffle')::double precision END AS c_shuffle,
      CASE WHEN cursor_key IS NULL THEN NULL ELSE ((cursor_key::jsonb)->>'id')::uuid END AS c_id
  ),
  hidden_post_ids AS (SELECT post_id FROM public.hidden_posts WHERE user_id = auth.uid()),
  hidden_user_ids AS (SELECT hidden_user_id FROM public.hidden_users WHERE user_id = auth.uid()),
  blocked_ids AS (
    SELECT blocked_user_id AS uid FROM public.blocked_users WHERE user_id = auth.uid()
    UNION
    SELECT user_id AS uid FROM public.blocked_users WHERE blocked_user_id = auth.uid()
  ),
  eligible_posts AS (
    SELECT
      p.id, p.user_id, p.content, p.created_at, p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      p.media_kind, p.aspect_ratio, p.suggested_height,
      pr.id as profile_id, pr.username as profile_username, pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
      false as is_repost, NULL::uuid as reposted_by_user_id, NULL::text as reposted_by_username,
      p.created_at as sort_time
    FROM public.posts p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.is_public = true
      AND (p.user_id = auth.uid() OR p.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid()))
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND p.user_id NOT IN (SELECT uid FROM blocked_ids)
      AND NOT EXISTS (SELECT 1 FROM public.post_seen s WHERE s.user_id = auth.uid() AND s.post_id = p.id)
    UNION ALL
    SELECT
      p.id, p.user_id, p.content, p.created_at, p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      p.media_kind, p.aspect_ratio, p.suggested_height,
      pr.id as profile_id, pr.username as profile_username, pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
      true as is_repost, r.user_id as reposted_by_user_id, pr_reposter.username as reposted_by_username,
      r.created_at as sort_time
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
      (abs(hashtext(coalesce(refresh_seed,'') || ':' || coalesce(auth.uid()::text,'') || ':' || e.id::text))::double precision / 2147483647.0) AS shuffle_score
    FROM eligible_posts e
  ),
  ranked AS (
    SELECT t.*,
      row_number() OVER (PARTITION BY t.tier, COALESCE(t.reposted_by_user_id, t.user_id), COALESCE(t.platform, '')
                         ORDER BY t.shuffle_score, t.id) AS cluster_rank
    FROM tiered t
  )
  SELECT r.id, r.user_id, r.content, r.created_at, r.likes_count, r.saves_count, r.comments_count, r.reposts_count,
         r.media_type, r.media_url, r.platform, r.embed_html, r.thumbnail_url, r.title, r.preview_text, r.preview_title,
         r.preview_image_url, r.is_public, r.media_kind, r.aspect_ratio, r.suggested_height,
         r.profile_id, r.profile_username, r.profile_display_name, r.profile_avatar_url, r.is_repost,
         r.reposted_by_user_id, r.reposted_by_username, r.sort_time as reposted_at,
         jsonb_build_object('tier', r.tier, 'rank', r.cluster_rank, 'shuffle', r.shuffle_score, 'id', r.id)::text AS feed_cursor
  FROM ranked r CROSS JOIN cursor_values cv
  WHERE (cursor_key IS NULL
    OR r.tier > cv.c_tier
    OR (r.tier = cv.c_tier AND r.cluster_rank > cv.c_rank)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_rank AND r.shuffle_score > cv.c_shuffle)
    OR (r.tier = cv.c_tier AND r.cluster_rank = cv.c_rank AND r.shuffle_score = cv.c_shuffle AND r.id > cv.c_id))
  ORDER BY r.tier ASC, r.cluster_rank ASC, r.shuffle_score ASC, r.id ASC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;

-- Feed v3
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

-- has_unseen_following_feed_posts (block filter)
CREATE OR REPLACE FUNCTION public.has_unseen_following_feed_posts()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH hidden_post_ids AS (SELECT post_id FROM public.hidden_posts WHERE user_id = auth.uid()),
       hidden_user_ids AS (SELECT hidden_user_id FROM public.hidden_users WHERE user_id = auth.uid()),
       blocked_ids AS (
         SELECT blocked_user_id AS uid FROM public.blocked_users WHERE user_id = auth.uid()
         UNION
         SELECT user_id AS uid FROM public.blocked_users WHERE blocked_user_id = auth.uid()
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
$$;

-- get_user_platform_counts (skip blocked target)
CREATE OR REPLACE FUNCTION public.get_user_platform_counts(target_user uuid)
RETURNS TABLE(platform text, post_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH combined AS (
    SELECT p.id, p.platform FROM posts p
    WHERE p.user_id = target_user AND p.is_public = true
      AND p.platform IS NOT NULL AND p.platform <> ''
      AND NOT public.are_blocked(auth.uid(), target_user)
    UNION
    SELECT p.id, p.platform FROM reposts r
    JOIN posts p ON p.id = r.post_id
    WHERE r.user_id = target_user AND p.is_public = true
      AND p.platform IS NOT NULL AND p.platform <> ''
      AND NOT public.are_blocked(auth.uid(), target_user)
      AND NOT public.are_blocked(auth.uid(), p.user_id)
  )
  SELECT c.platform, COUNT(*)::int AS post_count
  FROM combined c GROUP BY c.platform
  ORDER BY
    CASE WHEN c.platform = 'external' THEN 2
         WHEN c.platform = 'article' THEN 1 ELSE 0 END,
    post_count DESC;
$$;

-- get_user_platform_posts (skip if blocked)
CREATE OR REPLACE FUNCTION public.get_user_platform_posts(target_user uuid, platform_name text, limit_count integer, cursor timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, is_public boolean, is_repost boolean, original_user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.user_id, p.content,
    COALESCE(r.created_at, p.created_at) as created_at,
    p.likes_count, p.saves_count, p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
    p.is_public, (r.id IS NOT NULL) as is_repost,
    CASE WHEN r.id IS NOT NULL THEN p.user_id ELSE NULL END as original_user_id
  FROM posts p
  LEFT JOIN reposts r ON r.post_id = p.id AND r.user_id = target_user
  WHERE p.is_public = true
    AND p.platform = platform_name
    AND (p.user_id = target_user OR r.user_id = target_user)
    AND NOT public.are_blocked(auth.uid(), target_user)
    AND NOT public.are_blocked(auth.uid(), p.user_id)
    AND (cursor IS NULL OR COALESCE(r.created_at, p.created_at) < cursor)
  ORDER BY COALESCE(r.created_at, p.created_at) DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$$;

-- get_mutual_followers (skip blocked)
CREATE OR REPLACE FUNCTION public.get_mutual_followers_with_count(viewer_id uuid, profile_owner_id uuid)
RETURNS TABLE(username text, display_name text, total_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH mutuals AS (
    SELECT p.username, p.display_name, p.user_id
    FROM follows f1
    JOIN follows f2 ON f1.following_id = f2.follower_id
    JOIN profiles p ON p.user_id = f1.following_id
    WHERE f1.follower_id = viewer_id
      AND f2.following_id = profile_owner_id
      AND NOT public.are_blocked(viewer_id, p.user_id)
  )
  SELECT m.username, m.display_name, (SELECT count(*)::int FROM mutuals) AS total_count
  FROM mutuals m LIMIT 3;
$$;
