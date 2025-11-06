-- Create follows table for tracking user relationships
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Enable RLS on follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- RLS policies for follows
CREATE POLICY "Users can view all follows"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Add tsvector column to profiles for full-text search
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(username,'') || ' ' ||
      coalesce(display_name,'') || ' ' ||
      coalesce(bio,'')
    )
  ) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_profiles_search_tsv ON public.profiles USING gin (search_tsv);

-- Create indexes for exact lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles (display_name);

-- Create index on follows for performance
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

-- RPC function for searching profiles with follow status
CREATE OR REPLACE FUNCTION public.search_profiles(q text, limit_count int, cursor uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_following boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.*
    FROM profiles p
    WHERE
      (lower(p.username) = lower(q))
      OR (p.search_tsv @@ plainto_tsquery('simple', q))
      OR (p.username ILIKE '%'||q||'%')
      OR (p.display_name ILIKE '%'||q||'%')
  ),
  ranked AS (
    SELECT
      b.id, b.username, b.display_name, b.avatar_url,
      EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = auth.uid() AND f.following_id = b.id
      ) AS is_following
    FROM base b
    WHERE (cursor IS NULL OR b.id > cursor)
    ORDER BY
      (lower(b.username) = lower(q)) DESC,
      b.display_name ASC,
      b.username ASC
    LIMIT GREATEST(1, LEAST(limit_count, 50))
  )
  SELECT * FROM ranked;
$$;