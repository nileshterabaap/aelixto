ALTER TABLE public.remote_flags ADD COLUMN IF NOT EXISTS min_build integer;
INSERT INTO public.remote_flags (key, enabled, min_build) VALUES
  ('force_update_android', false, NULL),
  ('force_update_ios', false, NULL)
ON CONFLICT (key) DO NOTHING;