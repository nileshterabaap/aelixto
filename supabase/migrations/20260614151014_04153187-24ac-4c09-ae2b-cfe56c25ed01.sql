ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['like'::text, 'comment'::text, 'repost'::text, 'follow'::text, 'follow_request'::text, 'report_outcome'::text]));

DROP TRIGGER IF EXISTS trg_set_hour_bucket ON public.post_views;
CREATE TRIGGER trg_set_hour_bucket
BEFORE INSERT ON public.post_views
FOR EACH ROW EXECUTE FUNCTION public.set_hour_bucket();

DROP TRIGGER IF EXISTS trg_bump_aelix_score ON public.post_views;
CREATE TRIGGER trg_bump_aelix_score
AFTER INSERT ON public.post_views
FOR EACH ROW EXECUTE FUNCTION public.bump_aelix_score();

DROP TRIGGER IF EXISTS on_like_count ON public.likes;
CREATE TRIGGER on_like_count
AFTER INSERT OR DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

DROP TRIGGER IF EXISTS on_save_count ON public.saves;
CREATE TRIGGER on_save_count
AFTER INSERT OR DELETE ON public.saves
FOR EACH ROW EXECUTE FUNCTION public.update_saves_count();

DROP TRIGGER IF EXISTS on_comment_count ON public.comments;
CREATE TRIGGER on_comment_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.update_comments_count();

DROP TRIGGER IF EXISTS on_repost_count ON public.reposts;
CREATE TRIGGER on_repost_count
AFTER INSERT OR DELETE ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.update_reposts_count();

DROP TRIGGER IF EXISTS on_like_created ON public.likes;
CREATE TRIGGER on_like_created
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.handle_like_notification();

DROP TRIGGER IF EXISTS on_like_deleted ON public.likes;
CREATE TRIGGER on_like_deleted
AFTER DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.handle_like_notification_delete();

DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
CREATE TRIGGER on_comment_created
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_notification();

DROP TRIGGER IF EXISTS on_repost_created ON public.reposts;
CREATE TRIGGER on_repost_created
AFTER INSERT ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.handle_repost_notification();

DROP TRIGGER IF EXISTS on_repost_deleted ON public.reposts;
CREATE TRIGGER on_repost_deleted
AFTER DELETE ON public.reposts
FOR EACH ROW EXECUTE FUNCTION public.handle_repost_notification_delete();

DROP TRIGGER IF EXISTS on_follow_notify ON public.follows;
CREATE TRIGGER on_follow_notify
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_notification();

DROP TRIGGER IF EXISTS on_unfollow_notify ON public.follows;
CREATE TRIGGER on_unfollow_notify
AFTER DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_notification_delete();

DROP TRIGGER IF EXISTS trg_follow_request_notify ON public.follow_requests;
CREATE TRIGGER trg_follow_request_notify
AFTER INSERT ON public.follow_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_request_notification();

DROP TRIGGER IF EXISTS trg_follow_request_notify_delete ON public.follow_requests;
CREATE TRIGGER trg_follow_request_notify_delete
AFTER DELETE ON public.follow_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_follow_request_notification_delete();

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_comments_updated_at ON public.comments;
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_link_previews_updated_at ON public.link_previews;
CREATE TRIGGER update_link_previews_updated_at
BEFORE UPDATE ON public.link_previews
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_post_drafts_updated_at ON public.post_drafts;
CREATE TRIGGER update_post_drafts_updated_at
BEFORE UPDATE ON public.post_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts','profiles','likes','saves','comments','reposts','follows','follow_requests','notifications','messages','conversations','post_views']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;