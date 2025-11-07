-- Create indexes for efficient platform queries
create index if not exists idx_posts_user_platform_created
  on posts (user_id, platform, created_at desc);

create index if not exists idx_posts_user_created
  on posts (user_id, created_at desc);

create index if not exists idx_posts_platform_created
  on posts (platform, created_at desc);

-- RPC: Get platform counts for a user (only platforms with public posts)
create or replace function get_user_platform_counts(target_user uuid)
returns table(platform text, post_count int)
language sql stable security definer
set search_path = public
as $$
  select platform, count(*)::int as post_count
  from posts
  where user_id = target_user
    and is_public = true
    and coalesce(platform, '') <> ''
  group by platform
  order by post_count desc;
$$;

-- RPC: Get posts by user and platform with cursor pagination
create or replace function get_user_platform_posts(
  target_user uuid,
  platform_name text,
  limit_count int,
  cursor timestamptz default null
)
returns table(
  id uuid,
  user_id uuid,
  content text,
  created_at timestamp with time zone,
  likes_count integer,
  saves_count integer,
  media_type text,
  media_url text,
  platform text,
  embed_html text,
  thumbnail_url text,
  title text,
  is_public boolean
)
language sql stable security definer
set search_path = public
as $$
  select 
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
    p.is_public
  from posts p
  where p.user_id = target_user
    and p.is_public = true
    and p.platform = platform_name
    and (cursor is null or p.created_at < cursor)
  order by p.created_at desc
  limit greatest(1, least(limit_count, 50));
$$;