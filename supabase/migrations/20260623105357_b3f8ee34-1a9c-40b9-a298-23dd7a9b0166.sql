DO $$
DECLARE
  table_name text;
  realtime_tables text[] := ARRAY[
    'profiles',
    'notifications',
    'posts',
    'likes',
    'comments',
    'reposts',
    'saves',
    'collections',
    'collection_items',
    'messages',
    'conversations',
    'conversation_participants'
  ];
BEGIN
  FOREACH table_name IN ARRAY realtime_tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;

    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', table_name);
  END LOOP;
END $$;