-- Add thumbnail_url and embed_html columns to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS embed_html TEXT;