SELECT cron.unschedule('sweep-broken-posts-hourly');
SELECT cron.schedule(
  'sweep-broken-posts-frequent',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hhotresssetunubidrth.supabase.co/functions/v1/sweep-broken-posts',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhob3RyZXNzc2V0dW51YmlkcnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MzY1NTEsImV4cCI6MjA3NjMxMjU1MX0.vXPp7IeJD-BlPbU6bghARJAdYFOk0a-Js7swnAwlbuQ","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhob3RyZXNzc2V0dW51YmlkcnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MzY1NTEsImV4cCI6MjA3NjMxMjU1MX0.vXPp7IeJD-BlPbU6bghARJAdYFOk0a-Js7swnAwlbuQ"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);