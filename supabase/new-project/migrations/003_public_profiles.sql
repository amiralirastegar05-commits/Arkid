-- Additive social phase 1. This is separate from the private profiles table.
-- No existing profile, snapshot, game progress, or account is migrated/exposed.
-- A row is created only by its owner; visibility is explicitly opt-in.
create table public.arkid_public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  is_public boolean not null default false,
  revision uuid not null default pg_catalog.gen_random_uuid(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint arkid_public_name_length check (char_length(trim(display_name)) between 1 and 40),
  constraint arkid_public_bio_length check (char_length(bio) <= 160)
);

alter table public.arkid_public_profiles enable row level security;
revoke all on public.arkid_public_profiles from public, anon, authenticated;
grant select on public.arkid_public_profiles to authenticated;
grant insert (user_id, display_name, bio, is_public) on public.arkid_public_profiles to authenticated;
grant update (display_name, bio, is_public) on public.arkid_public_profiles to authenticated;

-- Signed-in players can see only opted-in profiles plus their own private row.
create policy arkid_public_profiles_read on public.arkid_public_profiles
  for select to authenticated using (is_public or (select auth.uid()) = user_id);
create policy arkid_public_profiles_insert_own on public.arkid_public_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy arkid_public_profiles_update_own on public.arkid_public_profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.arkid_public_profile_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision = pg_catalog.gen_random_uuid();
  new.updated_at = pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function public.arkid_public_profile_touch() from public, anon, authenticated;
create trigger arkid_public_profile_touch before update on public.arkid_public_profiles
  for each row execute function public.arkid_public_profile_touch();
