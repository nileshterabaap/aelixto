
-- Short links table: maps a short code to a relative app path (e.g. /post/<id> or /u/<username>)
CREATE TABLE IF NOT EXISTS public.short_links (
  code TEXT PRIMARY KEY,
  target_path TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS short_links_target_path_unique
  ON public.short_links (target_path);

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

-- Anyone can read short links (they're meant to be public redirect targets)
DROP POLICY IF EXISTS "Short links are publicly readable" ON public.short_links;
CREATE POLICY "Short links are publicly readable"
  ON public.short_links
  FOR SELECT
  USING (true);

-- No direct insert/update/delete from clients - go through the RPC.

-- RPC: get or create a short code for a target path.
CREATE OR REPLACE FUNCTION public.create_short_link(p_target_path TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing TEXT;
  v_code TEXT;
  v_attempts INT := 0;
  v_alphabet TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
BEGIN
  IF p_target_path IS NULL OR length(p_target_path) = 0 THEN
    RAISE EXCEPTION 'target_path is required';
  END IF;

  -- Only allow internal relative paths starting with '/'
  IF left(p_target_path, 1) <> '/' THEN
    RAISE EXCEPTION 'target_path must start with /';
  END IF;

  -- Reuse existing code for this path if available
  SELECT code INTO v_existing
  FROM public.short_links
  WHERE target_path = p_target_path
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Generate a unique 7-character code, retry on collision
  LOOP
    v_attempts := v_attempts + 1;
    v_code := '';
    FOR i IN 1..7 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.short_links (code, target_path)
      VALUES (v_code, p_target_path);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts > 8 THEN
        RAISE;
      END IF;
      -- try again
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_short_link(TEXT) TO anon, authenticated;
