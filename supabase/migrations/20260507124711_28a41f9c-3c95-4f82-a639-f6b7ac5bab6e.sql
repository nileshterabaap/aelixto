REVOKE EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) TO authenticated;