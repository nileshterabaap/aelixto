-- Create link_previews table for caching unfurled article data
CREATE TABLE IF NOT EXISTS public.link_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.link_previews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached previews (public read)
CREATE POLICY "Anyone can view link previews"
  ON public.link_previews
  FOR SELECT
  USING (true);

-- Create index for faster URL lookups
CREATE INDEX IF NOT EXISTS idx_link_previews_url ON public.link_previews(url);

-- Create index for TTL cleanup (updated_at)
CREATE INDEX IF NOT EXISTS idx_link_previews_updated_at ON public.link_previews(updated_at);

-- Add trigger for updated_at
CREATE TRIGGER update_link_previews_updated_at
  BEFORE UPDATE ON public.link_previews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();