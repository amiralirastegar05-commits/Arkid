-- Existing Arkid cloud project already has profiles, but predates these fields.
alter table public.profiles
  add column if not exists bio text not null default '',
  add column if not exists avatar_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_bio_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_bio_length check (char_length(bio) <= 160);
  end if;
end;
$$;
