CREATE TABLE public.remote_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.remote_flags TO anon, authenticated;
GRANT ALL ON public.remote_flags TO service_role;
ALTER TABLE public.remote_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read remote flags" ON public.remote_flags FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.remote_flags (key, enabled) VALUES ('ads_48h_install_gate', true);