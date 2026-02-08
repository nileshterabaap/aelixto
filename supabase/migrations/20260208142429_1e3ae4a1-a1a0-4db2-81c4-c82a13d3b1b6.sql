-- Add raw_json_data column to posts table for universal platform metadata
ALTER TABLE public.posts
ADD COLUMN raw_json_data JSONB NULL;

-- Add index for efficient querying of platform-specific data
CREATE INDEX idx_posts_raw_json_data ON public.posts USING GIN (raw_json_data);

-- Create connected_socials table for OAuth-linked accounts
CREATE TABLE public.connected_socials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  platform_username TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Add connect_prompt_dismissed to profiles settings
-- (We'll use the existing settings JSONB field, no migration needed)

-- Enable RLS on connected_socials
ALTER TABLE public.connected_socials ENABLE ROW LEVEL SECURITY;

-- Users can only view their own connected socials
CREATE POLICY "Users can view their own connected socials"
ON public.connected_socials
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own connected socials
CREATE POLICY "Users can insert their own connected socials"
ON public.connected_socials
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connected socials
CREATE POLICY "Users can update their own connected socials"
ON public.connected_socials
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own connected socials
CREATE POLICY "Users can delete their own connected socials"
ON public.connected_socials
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_connected_socials_updated_at
BEFORE UPDATE ON public.connected_socials
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();