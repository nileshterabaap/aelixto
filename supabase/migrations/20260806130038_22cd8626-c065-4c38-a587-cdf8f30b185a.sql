create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user'
  ));
  base := regexp_replace(base, '[^a-z0-9_.]', '', 'g');
  if base is null or length(base) < 3 then
    base := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  base := left(base, 24);

  candidate := base;
  while exists (select 1 from public.profiles p where lower(p.username) = candidate) loop
    n := n + 1;
    candidate := left(base, 20) || n::text;
    if n > 500 then
      candidate := 'user' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
      exit;
    end if;
  end loop;

  insert into public.profiles (id, user_id, username, created_at, updated_at)
  values (new.id, new.id, candidate, now(), now());
  return new;
end $function$;