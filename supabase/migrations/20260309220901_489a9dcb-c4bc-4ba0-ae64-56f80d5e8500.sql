
-- Backfill existing posts with proper platform classification

-- 1. Known platform domains that were previously unclassified
UPDATE posts SET platform = 'threads' 
WHERE (platform IS NULL OR platform = '') 
  AND (media_url LIKE '%threads.com%' OR media_url LIKE '%threads.net%');

UPDATE posts SET platform = 'linkedin' 
WHERE (platform IS NULL OR platform = '') 
  AND media_url LIKE '%linkedin.com%';

UPDATE posts SET platform = 'facebook' 
WHERE (platform IS NULL OR platform = '') 
  AND (media_url LIKE '%facebook.com%' OR media_url LIKE '%fb.watch%' OR media_url LIKE '%fb.me%');

UPDATE posts SET platform = 'spotify' 
WHERE (platform IS NULL OR platform = '') 
  AND media_url LIKE '%spotify.com%';

-- 2. Reclassify medium and blog as article
UPDATE posts SET platform = 'article' WHERE platform IN ('medium', 'blog');

-- 3. Known article domains
UPDATE posts SET platform = 'article' 
WHERE (platform IS NULL OR platform = '') 
  AND (
    media_url LIKE '%medium.com%' OR
    media_url LIKE '%substack.com%' OR
    media_url LIKE '%ghost.io%' OR
    media_url LIKE '%wordpress.com%' OR
    media_url LIKE '%hashnode.com%' OR
    media_url LIKE '%dev.to%' OR
    media_url LIKE '%mirror.xyz%' OR
    media_url LIKE '%blogger.com%'
  );

-- 4. Everything else with a media_url but no platform → external
UPDATE posts SET platform = 'external' 
WHERE (platform IS NULL OR platform = '') 
  AND media_url IS NOT NULL 
  AND media_url != '';

-- 5. Recreate get_user_platform_counts (same logic, but now all posts have a platform)
CREATE OR REPLACE FUNCTION public.get_user_platform_counts(target_user uuid)
RETURNS TABLE(platform text, post_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select p.platform, count(*)::int as post_count
  from posts p
  where p.user_id = target_user
    and p.is_public = true
    and p.platform IS NOT NULL
    and p.platform != ''
  group by p.platform
  order by 
    -- Known platforms first, then articles, then external last
    case 
      when p.platform = 'external' then 2
      when p.platform = 'article' then 1
      else 0 
    end,
    post_count desc;
$$;
