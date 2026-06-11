CREATE TABLE IF NOT EXISTS public.domain_classifications (
  domain TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('article','external')),
  vote_count INTEGER NOT NULL DEFAULT 1,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.domain_classifications TO anon, authenticated;
GRANT ALL ON public.domain_classifications TO service_role;

ALTER TABLE public.domain_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read domain classifications"
  ON public.domain_classifications FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.record_domain_classification(
  _domain TEXT,
  _content_type TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _content_type NOT IN ('article','external') THEN
    RAISE EXCEPTION 'invalid content_type';
  END IF;
  IF _domain IS NULL OR length(trim(_domain)) = 0 THEN
    RAISE EXCEPTION 'invalid domain';
  END IF;

  INSERT INTO public.domain_classifications (domain, content_type, vote_count, updated_by, updated_at)
  VALUES (lower(trim(_domain)), _content_type, 1, auth.uid(), now())
  ON CONFLICT (domain) DO UPDATE
    SET content_type = EXCLUDED.content_type,
        vote_count = public.domain_classifications.vote_count + 1,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_domain_classification(TEXT, TEXT) TO authenticated;