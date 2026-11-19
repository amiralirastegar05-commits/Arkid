-- The application only reads the current user's profile. Avoid exposing any
-- legacy/private columns to every signed-in user via select('*').
drop policy if exists "Authenticated users can view profiles" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
-- Do not allow clients to change id, timestamps, or unreviewed legacy columns.
revoke update on public.profiles from authenticated;
grant update (username, display_name, bio, avatar_path) on public.profiles to authenticated;
