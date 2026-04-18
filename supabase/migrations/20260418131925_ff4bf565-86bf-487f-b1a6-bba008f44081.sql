
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Reports
CREATE TYPE public.report_reason AS ENUM (
  'spam', 'harassment', 'hate_speech', 'nudity_sexual',
  'violence', 'misinformation', 'self_harm', 'other'
);

CREATE TYPE public.report_target AS ENUM ('post', 'user');

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target NOT NULL,
  target_post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reason public.report_reason NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_target_check CHECK (
    (target_type = 'post' AND target_post_id IS NOT NULL AND target_user_id IS NULL) OR
    (target_type = 'user' AND target_user_id IS NOT NULL AND target_post_id IS NULL)
  )
);

CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX idx_reports_post ON public.reports(target_post_id);
CREATE INDEX idx_reports_user ON public.reports(target_user_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
  ON public.reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Hidden posts / users (per reporter)
CREATE TABLE public.hidden_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE public.hidden_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own hidden posts"
  ON public.hidden_posts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.hidden_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hidden_user_id)
);

ALTER TABLE public.hidden_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own hidden users"
  ON public.hidden_users FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Update following feed to exclude hidden content
CREATE OR REPLACE FUNCTION public.get_following_feed(limit_count integer, cursor timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, user_id uuid, content text, created_at timestamp with time zone, likes_count integer, saves_count integer, comments_count integer, reposts_count integer, media_type text, media_url text, platform text, embed_html text, thumbnail_url text, title text, preview_text text, preview_title text, preview_image_url text, is_public boolean, profile_id uuid, profile_username text, profile_display_name text, profile_avatar_url text, is_repost boolean, reposted_by_user_id uuid, reposted_by_username text, reposted_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH seen_ids AS (
    SELECT post_id FROM post_seen WHERE user_id = auth.uid()
  ),
  hidden_post_ids AS (
    SELECT post_id FROM hidden_posts WHERE user_id = auth.uid()
  ),
  hidden_user_ids AS (
    SELECT hidden_user_id FROM hidden_users WHERE user_id = auth.uid()
  ),
  following_posts AS (
    SELECT 
      p.id, p.user_id, p.content, p.created_at,
      p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      pr.id as profile_id, pr.username as profile_username,
      pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
      false as is_repost, NULL::uuid as reposted_by_user_id, NULL::text as reposted_by_username,
      p.created_at as sort_time
    FROM posts p
    LEFT JOIN profiles pr ON pr.user_id = p.user_id
    WHERE p.is_public = true
      AND p.user_id IN (SELECT following_id FROM follows WHERE follower_id = auth.uid())
      AND p.id NOT IN (SELECT post_id FROM seen_ids)
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND (cursor IS NULL OR p.created_at < cursor)
    UNION ALL
    SELECT 
      p.id, p.user_id, p.content, p.created_at,
      p.likes_count, p.saves_count, p.comments_count, p.reposts_count,
      p.media_type, p.media_url, p.platform, p.embed_html, p.thumbnail_url, p.title,
      p.preview_text, p.preview_title, p.preview_image_url, p.is_public,
      pr.id as profile_id, pr.username as profile_username,
      pr.display_name as profile_display_name, pr.avatar_url as profile_avatar_url,
      true as is_repost, r.user_id as reposted_by_user_id, pr_reposter.username as reposted_by_username,
      r.created_at as sort_time
    FROM reposts r
    INNER JOIN posts p ON p.id = r.post_id
    LEFT JOIN profiles pr ON pr.user_id = p.user_id
    LEFT JOIN profiles pr_reposter ON pr_reposter.user_id = r.user_id
    WHERE p.is_public = true
      AND r.user_id IN (SELECT following_id FROM follows WHERE follower_id = auth.uid())
      AND p.id NOT IN (SELECT post_id FROM seen_ids)
      AND p.id NOT IN (SELECT post_id FROM hidden_post_ids)
      AND p.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND r.user_id NOT IN (SELECT hidden_user_id FROM hidden_user_ids)
      AND (cursor IS NULL OR r.created_at < cursor)
  )
  SELECT id, user_id, content, created_at, likes_count, saves_count, comments_count, reposts_count,
    media_type, media_url, platform, embed_html, thumbnail_url, title,
    preview_text, preview_title, preview_image_url, is_public,
    profile_id, profile_username, profile_display_name, profile_avatar_url,
    is_repost, reposted_by_user_id, reposted_by_username, sort_time as reposted_at
  FROM following_posts
  ORDER BY sort_time DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$function$;
