-- Arkid Phase 1: user profile foundation.
-- Run this in the Supabase SQL Editor or through the Supabase CLI.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text not null default '',
  bio text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format
    check (username is null or username ~ '^[a-zA-Z0-9_]{3,24}$'),
  constraint profiles_bio_length
    check (char_length(bio) <= 160)
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

create index if not exists profiles_updated_at_idx
  on public.profiles (updated_at desc);

alter table public.profiles enable row level security;

-- Keep Data API access limited to signed-in users and the fields covered by RLS.
revoke all on public.profiles from public, anon;
grant select, update on public.profiles to authenticated;

-- Authenticated users may view public profile fields.
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

-- A user may update only their own profile.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Profile rows are created automatically when an Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Keep updated_at current for profile edits.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- No public/anonymous read policy and no client-side insert policy.
-- Profile creation is handled by the Auth trigger.
