ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY['like','comment','repost','follow','follow_request','follow_accepted','message','report_outcome','new_post']));

CREATE OR REPLACE FUNCTION public.handle_new_post_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
  SELECT f.follower_id, NEW.user_id, 'new_post', NEW.id
  FROM public.follows f
  WHERE f.following_id = NEW.user_id
    AND f.follower_id <> NEW.user_id
    AND public.notif_flag_allowed(f.follower_id, 'notif_new_posts')
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users b
      WHERE (b.user_id = f.follower_id AND b.blocked_user_id = NEW.user_id)
         OR (b.user_id = NEW.user_id AND b.blocked_user_id = f.follower_id)
    );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_post_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_post_created_notify_followers ON public.posts;
CREATE TRIGGER on_post_created_notify_followers
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.handle_new_post_notification();