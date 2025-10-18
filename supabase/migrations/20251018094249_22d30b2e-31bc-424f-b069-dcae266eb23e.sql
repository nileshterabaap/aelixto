-- Add foreign key relationship between posts and profiles
ALTER TABLE public.posts 
DROP CONSTRAINT IF EXISTS posts_user_id_fkey;

ALTER TABLE public.posts
ADD CONSTRAINT posts_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;