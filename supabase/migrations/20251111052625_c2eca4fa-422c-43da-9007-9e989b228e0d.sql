-- 1) Table to store view/attention events
create table if not exists public.post_views (
  id bigserial primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null,
  viewer_id uuid null,
  device_hash text null,
  ip_hash text null,
  event_type text not null check (event_type in ('video_play','image_view')),
  duration_ms int not null default 0,
  created_at timestamptz not null default now(),
  hour_bucket timestamptz not null default date_trunc('hour', now())
);

-- 2) Trigger to set hour_bucket before insert
create or replace function public.set_hour_bucket()
returns trigger language plpgsql as $$
begin
  new.hour_bucket := date_trunc('hour', new.created_at);
  return new;
end $$;

create trigger trg_set_hour_bucket
before insert on public.post_views
for each row execute function public.set_hour_bucket();

-- 3) De-duplication / cooldown: at most 1 count per (viewer/device) per post per hour
create unique index if not exists uniq_post_view_guard
on public.post_views (post_id, coalesce(viewer_id::text, device_hash), event_type, hour_bucket);

-- 4) Increment author's score on insert (safe, dedup above ensures sane growth)
create or replace function public.bump_aelix_score()
returns trigger language plpgsql 
security definer
set search_path = public
as $$
begin
  update public.profiles
     set aelix_score = aelix_score + 1
   where user_id = new.author_id;
  return new;
end $$;

drop trigger if exists trg_bump_aelix_score on public.post_views;
create trigger trg_bump_aelix_score
after insert on public.post_views
for each row execute function public.bump_aelix_score();

-- 5) RLS: post_views is service-written only (via edge function). Deny direct client writes.
alter table public.post_views enable row level security;

create policy "read scores anon ok" on public.post_views
for select using (true);

-- No insert/update/delete policy for anon; only the edge function with service role inserts.