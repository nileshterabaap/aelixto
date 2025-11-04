-- Drop trigger if exists
drop trigger if exists update_profiles_updated_at on public.profiles;

-- Create profiles table with RLS
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-zA-Z0-9_.]{3,30}$'),
  display_name text,
  bio text,
  avatar_url text,
  cover_url text,
  aelix_score int default 0,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Drop existing policies if they exist
drop policy if exists "read all profiles" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "insert own profile" on public.profiles;

-- RLS Policies
create policy "read all profiles" on public.profiles 
  for select using (true);

create policy "update own profile" on public.profiles 
  for update using (auth.uid() = id);

create policy "insert own profile" on public.profiles 
  for insert with check (auth.uid() = id);

-- Create index for username lookups
create index if not exists idx_profiles_username on public.profiles(username);

-- Update trigger for updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();