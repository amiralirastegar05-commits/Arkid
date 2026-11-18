-- Cache the auth.uid() result per statement instead of reevaluating it per row.
alter policy "Users can update their own profile"
  on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
