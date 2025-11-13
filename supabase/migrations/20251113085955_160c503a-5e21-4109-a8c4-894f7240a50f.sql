-- Add preview fields to posts table for fast AMP-like previews
ALTER TABLE posts ADD COLUMN IF NOT EXISTS preview_title TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS preview_image_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS preview_text TEXT;