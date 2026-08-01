select vault.create_secret('db32fbe745b3faf1458c8651c759289bede9553afcf0124bd791a101f17a1934', 'push_trigger_secret', 'Shared secret for DB trigger -> send-push-notification');

create or replace function public.notify_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  actor_name text;
  title text;
  body text;
  url text;
  project_url text := 'https://hhotresssetunubidrth.supabase.co';
  push_secret text;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO actor_name
  FROM public.profiles WHERE user_id = NEW.actor_id LIMIT 1;

  IF NEW.type = 'follow' THEN
    title := actor_name || ' followed you'; url := '/notifications';
  ELSIF NEW.type = 'like' THEN
    title := actor_name || ' liked your post'; url := '/notifications';
  ELSIF NEW.type = 'comment' THEN
    title := actor_name || ' commented on your post'; url := '/notifications';
  ELSIF NEW.type = 'repost' THEN
    title := actor_name || ' reposted your post'; url := '/notifications';
  ELSIF NEW.type = 'message' THEN
    title := actor_name || ' sent you a message'; url := '/messages';
  ELSE
    title := 'New notification'; url := '/notifications';
  END IF;
  body := '';

  SELECT decrypted_secret INTO push_secret
  FROM vault.decrypted_secrets WHERE name = 'push_trigger_secret' LIMIT 1;

  IF push_secret IS NULL OR push_secret = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-push-secret', push_secret
    ),
    body := jsonb_build_object(
      'userId', NEW.recipient_id,
      'title', title,
      'body', body,
      'url', url
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

create or replace function public.handle_message_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
BEGIN
  INSERT INTO public.notifications (recipient_id, actor_id, type, metadata)
  SELECT cp.user_id, NEW.sender_id, 'message',
         jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id
    AND NOT public.are_blocked(cp.user_id, NEW.sender_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

drop trigger if exists on_message_created_notification on public.messages;
create trigger on_message_created_notification
after insert on public.messages
for each row execute function public.handle_message_notification();