-- Backfill Threads posts missing preview text or thumbnail by clearing the
-- empty fields so the refresh-thumbnails / re-fetch path picks them up.
UPDATE public.posts
SET preview_text = NULL
WHERE platform = 'threads'
  AND (preview_text IS NULL OR preview_text = '' OR preview_text = 'Threads');