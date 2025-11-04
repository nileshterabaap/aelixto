-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS cover_url TEXT,
ADD COLUMN IF NOT EXISTS aelix_score INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb NOT NULL;