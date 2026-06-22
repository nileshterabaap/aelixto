REVOKE EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_following_feed_v2(integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_following_feed(integer, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_following_feed(integer, timestamp with time zone) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_following_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_following_count() TO authenticated;