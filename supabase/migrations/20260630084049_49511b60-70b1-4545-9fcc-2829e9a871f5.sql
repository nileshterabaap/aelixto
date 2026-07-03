-- Clear false "source removed" notifications for X/Twitter/LinkedIn/Threads/Pinterest/Quora/Medium/article posts.
-- These platforms block bot UAs so the validator could not reliably tell removed from blocked.
DELETE FROM public.notifications
WHERE type = 'report_outcome'
  AND metadata->>'kind' = 'source_removed'
  AND lower(coalesce(metadata->>'platform','')) IN ('x','twitter','threads','linkedin','pinterest','quora','medium','article','external');

-- Reset broken counters on those posts so the check starts clean.
UPDATE public.posts
SET broken_check_count = 0, broken_first_seen_at = NULL
WHERE lower(coalesce(platform,'')) IN ('x','twitter','threads','linkedin','pinterest','quora','medium','article','external');