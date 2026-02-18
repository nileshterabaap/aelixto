
-- Add parent_id to comments for reply threading
ALTER TABLE public.comments ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Index for fast lookup of replies
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);
