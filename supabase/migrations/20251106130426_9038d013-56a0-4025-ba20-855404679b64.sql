-- Fix foreign key constraints to reference user_id instead of id
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;

-- Add correct foreign key constraints to profiles.user_id
ALTER TABLE public.follows 
  ADD CONSTRAINT follows_follower_id_fkey 
  FOREIGN KEY (follower_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE CASCADE;

ALTER TABLE public.follows 
  ADD CONSTRAINT follows_following_id_fkey 
  FOREIGN KEY (following_id) 
  REFERENCES public.profiles(user_id) 
  ON DELETE CASCADE;