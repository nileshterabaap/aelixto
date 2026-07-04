CREATE OR REPLACE FUNCTION public.set_hour_bucket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.hour_bucket := date_trunc('hour', COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_hour_bucket ON public.post_views;
CREATE TRIGGER trg_set_hour_bucket
BEFORE INSERT ON public.post_views
FOR EACH ROW EXECUTE FUNCTION public.set_hour_bucket();

CREATE OR REPLACE FUNCTION public.bump_aelix_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET aelix_score = COALESCE(aelix_score, 0) + 1,
         updated_at = now()
   WHERE user_id = NEW.author_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_aelix_score ON public.post_views;
CREATE TRIGGER trg_bump_aelix_score
AFTER INSERT ON public.post_views
FOR EACH ROW EXECUTE FUNCTION public.bump_aelix_score();

DO $$
DECLARE
  table_name text;
  table_names text[] := ARRAY[
    'posts',
    'profiles',
    'likes',
    'saves',
    'comments',
    'reposts',
    'follows',
    'notifications',
    'messages',
    'conversations',
    'post_views'
  ];
BEGIN
  FOREACH table_name IN ARRAY table_names LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$$;