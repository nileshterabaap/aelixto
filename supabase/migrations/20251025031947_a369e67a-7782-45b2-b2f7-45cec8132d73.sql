-- Add embed_html column to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS embed_html TEXT;