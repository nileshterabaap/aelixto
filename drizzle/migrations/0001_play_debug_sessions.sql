CREATE TABLE public.play_debug_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  platform text,
  user_agent text,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.play_debug_sessions TO authenticated;
GRANT ALL ON public.play_debug_sessions TO service_role;
ALTER TABLE public.play_debug_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insert" ON public.play_debug_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own select" ON public.play_debug_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.play_debug_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);