-- Fix 1: Restrict post_views SELECT to only authors viewing their own post stats
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "read scores anon ok" ON public.post_views;

-- Create a new policy that allows:
-- 1. Post authors to see views on their own posts (for analytics)
-- 2. Authenticated users to see their own view records
CREATE POLICY "Authors can view their post analytics"
  ON public.post_views
  FOR SELECT
  USING (
    auth.uid() = author_id OR auth.uid() = viewer_id
  );

-- Fix 2: Restrict link_previews SELECT to authenticated users only
-- The cached content should not be publicly accessible
DROP POLICY IF EXISTS "Anyone can view link previews" ON public.link_previews;

-- Create a policy that only allows authenticated users to read cached previews
CREATE POLICY "Authenticated users can view link previews"
  ON public.link_previews
  FOR SELECT
  USING (auth.uid() IS NOT NULL);