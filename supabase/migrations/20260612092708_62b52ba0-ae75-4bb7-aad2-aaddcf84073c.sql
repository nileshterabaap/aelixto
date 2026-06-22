ALTER TABLE public.post_views DROP CONSTRAINT IF EXISTS post_views_event_type_check;
ALTER TABLE public.post_views ADD CONSTRAINT post_views_event_type_check
  CHECK (event_type IN ('video_play','image_view','article_open','external_visit','original_visit'));