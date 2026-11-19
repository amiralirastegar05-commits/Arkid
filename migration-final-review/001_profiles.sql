-- Fresh Arkid projects only; never apply to a legacy project.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  display_name text not null default '',
  bio text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username ~ '^[a-zA-Z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (char_length(display_name) <= 120),
  constraint profiles_bio_length check (char_length(bio) <= 160),
  constraint profiles_avatar_path_length check (avatar_path is null or char_length(avatar_path) <= 512)
);
create unique index profiles_username_lower_unique on public.profiles (lower(username)) where username is not null;
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_path) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function public.arkid_create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end;
$$;
revoke all on function public.arkid_create_profile() from public, anon, authenticated;
create trigger arkid_create_profile after insert on auth.users for each row execute function public.arkid_create_profile();

create function public.arkid_profile_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.arkid_profile_updated_at() from public, anon, authenticated;
create trigger arkid_profile_updated_at before update on public.profiles for each row execute function public.arkid_profile_updated_at();
