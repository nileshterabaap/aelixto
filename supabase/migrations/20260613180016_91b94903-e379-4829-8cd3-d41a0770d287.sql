DROP INDEX IF EXISTS public.post_views_dedup_idx;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_post_view_guard
ON public.post_views (post_id, COALESCE(viewer_id::text, device_hash), event_type, hour_bucket);