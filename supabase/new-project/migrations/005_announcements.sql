-- Server-authored update announcements; no player can create or alter them.
-- Existing accounts and game data are not modified.
create table public.arkid_announcements (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 100),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  published boolean not null default false,
  starts_at timestamptz not null default pg_catalog.clock_timestamp(),
  ends_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (ends_at is null or ends_at > starts_at)
);
create index arkid_announcements_feed on public.arkid_announcements(starts_at desc,id) where published;
create table public.arkid_announcement_reads (
  announcement_id uuid not null references public.arkid_announcements(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (announcement_id,user_id)
);
alter table public.arkid_announcements enable row level security;
alter table public.arkid_announcement_reads enable row level security;
revoke all on public.arkid_announcements, public.arkid_announcement_reads from public, anon, authenticated;

-- Only currently active/published notices, in bounded order. No capability to
-- enumerate drafts or other players' read receipts is exposed to clients.
create function public.arkid_announcement_feed()
returns table(announcement_id uuid,title text,body text,starts_at timestamptz,is_read boolean)
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  return query select a.id,a.title,a.body,a.starts_at,(r.user_id is not null)
    from public.arkid_announcements a
    left join public.arkid_announcement_reads r on r.announcement_id=a.id and r.user_id=uid
    where a.published and a.starts_at<=pg_catalog.clock_timestamp()
      and (a.ends_at is null or a.ends_at>pg_catalog.clock_timestamp())
    order by a.starts_at desc,a.id limit 30;
end; $$;

create function public.arkid_read_announcement(notice uuid)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if not exists(select 1 from public.arkid_announcements a where a.id=notice and a.published and a.starts_at<=pg_catalog.clock_timestamp() and (a.ends_at is null or a.ends_at>pg_catalog.clock_timestamp())) then
    raise exception 'announcement_unavailable' using errcode='22023';
  end if;
  insert into public.arkid_announcement_reads(announcement_id,user_id) values(notice,uid)
    on conflict (announcement_id,user_id) do nothing;
  return 'read';
end; $$;
revoke all on function public.arkid_announcement_feed(),public.arkid_read_announcement(uuid) from public,anon,authenticated;
grant execute on function public.arkid_announcement_feed(),public.arkid_read_announcement(uuid) to authenticated;
