-- Fix search path for hour bucket function
create or replace function public.set_hour_bucket()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  new.hour_bucket := date_trunc('hour', new.created_at);
  return new;
end $$;