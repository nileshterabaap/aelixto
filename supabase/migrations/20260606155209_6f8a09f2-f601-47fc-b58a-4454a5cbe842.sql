CREATE OR REPLACE FUNCTION public.get_mutual_followers(viewer_id uuid, profile_owner_id uuid)
RETURNS TABLE(username text, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.username, p.display_name
  FROM follows f1
  JOIN follows f2 ON f1.following_id = f2.follower_id
  JOIN profiles p ON p.user_id = f1.following_id
  WHERE f1.follower_id = viewer_id
    AND f2.following_id = profile_owner_id
  LIMIT 3;
$$;