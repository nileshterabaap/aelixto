CREATE OR REPLACE FUNCTION public.notify_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor_name text;
  title text;
  body text;
  url text;
  project_url text := 'https://hhotresssetunubidrth.supabase.co';
  push_secret text;
BEGIN
  -- Always prefer the username (without @) over the display name.
  SELECT COALESCE(NULLIF(username, ''), 'Someone') INTO actor_name
  FROM public.profiles WHERE user_id = NEW.actor_id LIMIT 1;
  actor_name := COALESCE(NULLIF(ltrim(actor_name, '@'), ''), 'Someone');

  IF NEW.type = 'follow' THEN
    title := actor_name || ' followed you'; url := '/notifications';
  ELSIF NEW.type = 'like' THEN
    title := actor_name || ' liked your post'; url := '/notifications';
  ELSIF NEW.type = 'comment' THEN
    title := actor_name || ' commented on your post'; url := '/notifications';
  ELSIF NEW.type = 'repost' THEN
    title := actor_name || ' reposted your post'; url := '/notifications';
  ELSIF NEW.type = 'follow_request' THEN
    title := actor_name || ' asked to Follow'; url := '/notifications';
  ELSIF NEW.type = 'follow_accepted' THEN
    title := actor_name || ' accepted your follow ask'; url := '/notifications';
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
$function$;