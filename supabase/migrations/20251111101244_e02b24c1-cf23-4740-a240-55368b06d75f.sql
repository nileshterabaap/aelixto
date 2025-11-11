
-- Add unique constraint to prevent duplicate view counting
-- This ensures each user (identified by viewer_id, device_hash, or ip_hash) 
-- can only count once per post per hour
CREATE UNIQUE INDEX post_views_dedup_idx ON public.post_views (
  post_id,
  COALESCE(viewer_id::text, ''),
  COALESCE(device_hash, ''),
  COALESCE(ip_hash, ''),
  hour_bucket
);
