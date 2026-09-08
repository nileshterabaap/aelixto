
CREATE TABLE public.install_metadata (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  platform text,
  PRIMARY KEY (user_id, device_id)
);

GRANT SELECT, INSERT, UPDATE ON public.install_metadata TO authenticated;
GRANT ALL ON public.install_metadata TO service_role;

ALTER TABLE public.install_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own install metadata"
  ON public.install_metadata FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own install metadata"
  ON public.install_metadata FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own install metadata"
  ON public.install_metadata FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
