-- Explicit, whole-device snapshots. The client is not trusted to mutate revisions.
-- No gameplay balance is authoritative; snapshots are private user-controlled backups.
create table if not exists public.arkid_cloud_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint arkid_snapshot_size check (octet_length(data::text) <= 2097152)
);
create table if not exists public.arkid_cloud_snapshot_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision uuid not null,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (user_id, revision)
);
alter table public.arkid_cloud_snapshots enable row level security;
alter table public.arkid_cloud_snapshot_history enable row level security;
revoke all on public.arkid_cloud_snapshots, public.arkid_cloud_snapshot_history from public, anon, authenticated;
grant select on public.arkid_cloud_snapshots, public.arkid_cloud_snapshot_history to authenticated;
drop policy if exists "Read own snapshot" on public.arkid_cloud_snapshots;
create policy "Read own snapshot" on public.arkid_cloud_snapshots for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Read own snapshot history" on public.arkid_cloud_snapshot_history;
create policy "Read own snapshot history" on public.arkid_cloud_snapshot_history for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.arkid_save_snapshot(expected_user uuid, expected_revision uuid, snapshot jsonb)
returns public.arkid_cloud_snapshots
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  old_row public.arkid_cloud_snapshots;
  new_row public.arkid_cloud_snapshots;
begin
  if uid is null or uid is distinct from expected_user then raise exception 'account changed' using errcode = '42501'; end if;
  if snapshot is null or jsonb_typeof(snapshot) <> 'object'
    or snapshot->>'schema' is distinct from '1'
    or jsonb_typeof(snapshot->'storage') is distinct from 'object'
    or octet_length(snapshot::text) > 2097152 then
    raise exception 'invalid snapshot' using errcode = '22023';
  end if;
  -- Serialize even the first insert for this user; comparison and write are atomic.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select * into old_row from public.arkid_cloud_snapshots where user_id = uid;
  if old_row.user_id is null then
    if expected_revision is not null then raise exception 'snapshot conflict' using errcode = '40001'; end if;
    insert into public.arkid_cloud_snapshots(user_id, revision, data)
      values (uid, pg_catalog.gen_random_uuid(), snapshot) returning * into new_row;
  else
    if expected_revision is distinct from old_row.revision then raise exception 'snapshot conflict' using errcode = '40001'; end if;
    insert into public.arkid_cloud_snapshot_history(user_id, revision, data, updated_at)
      values (uid, old_row.revision, old_row.data, old_row.updated_at);
    update public.arkid_cloud_snapshots set revision = pg_catalog.gen_random_uuid(), data = snapshot, updated_at = now()
      where user_id = uid returning * into new_row;
  end if;
  return new_row;
end;
$$;
revoke all on function public.arkid_save_snapshot(uuid, uuid, jsonb) from public, anon;
grant execute on function public.arkid_save_snapshot(uuid, uuid, jsonb) to authenticated;
