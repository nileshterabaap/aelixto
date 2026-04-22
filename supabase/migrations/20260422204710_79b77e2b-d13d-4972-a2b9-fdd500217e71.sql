
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.post_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  link_url TEXT,
  caption TEXT,
  title TEXT,
  thumbnail_url TEXT,
  embed_html TEXT,
  platform TEXT,
  media_type TEXT,
  og_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own drafts"
  ON public.post_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own drafts"
  ON public.post_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
  ON public.post_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
  ON public.post_drafts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_post_drafts_updated_at
  BEFORE UPDATE ON public.post_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_post_drafts_user_created ON public.post_drafts(user_id, created_at DESC);
