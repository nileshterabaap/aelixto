CREATE TABLE public.trace_logs (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  post_id UUID,
  event TEXT NOT NULL,
  platform TEXT,
  step TEXT,
  detail JSONB,
  error TEXT
);
GRANT SELECT ON public.trace_logs TO authenticated;
GRANT INSERT ON public.trace_logs TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.trace_logs_id_seq TO anon, authenticated;
GRANT ALL ON public.trace_logs TO service_role;
GRANT ALL ON SEQUENCE public.trace_logs_id_seq TO service_role;
ALTER TABLE public.trace_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert trace" ON public.trace_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can read trace" ON public.trace_logs FOR SELECT TO authenticated USING (true);