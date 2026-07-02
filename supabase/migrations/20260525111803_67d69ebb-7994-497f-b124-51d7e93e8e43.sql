
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS broken_check_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS broken_first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz;

CREATE INDEX IF NOT EXISTS posts_last_validated_at_idx
  ON public.posts (last_validated_at NULLS FIRST);
