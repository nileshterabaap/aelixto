-- Add likes table to track user likes
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Add saves table to track saved posts
CREATE TABLE IF NOT EXISTS public.saves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Add likes_count to posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;

-- RLS policies for likes
CREATE POLICY "Users can view all likes"
  ON public.likes FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own likes"
  ON public.likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON public.likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for saves
CREATE POLICY "Users can view their own saves"
  ON public.saves FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saves"
  ON public.saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saves"
  ON public.saves FOR DELETE
  USING (auth.uid() = user_id);