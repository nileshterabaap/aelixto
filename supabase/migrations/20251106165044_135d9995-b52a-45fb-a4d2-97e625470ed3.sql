-- Add is_public column to posts table (defaults to true for backward compatibility)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Create indexes for fast feed queries
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);

-- Function to get following count for current user
CREATE OR REPLACE FUNCTION get_following_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM follows
  WHERE follower_id = auth.uid();
$$;

-- Function to get following feed with cursor-based pagination
CREATE OR REPLACE FUNCTION get_following_feed(limit_count int, cursor timestamptz DEFAULT NULL)
RETURNS SETOF posts
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM posts p
  WHERE p.is_public = true
    AND p.user_id IN (
      SELECT following_id FROM follows WHERE follower_id = auth.uid()
    )
    AND (cursor IS NULL OR p.created_at < cursor)
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(limit_count, 50));
$$;