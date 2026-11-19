-- Snapshots are user-controlled backups, not authoritative game economy.
create table public.arkid_cloud_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint snapshot_size check (octet_length(data::text) <= 2097152)
);
create table public.arkid_cloud_snapshot_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision uuid not null,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (user_id, revision),
  constraint history_snapshot_size check (octet_length(data::text) <= 2097152)
);
alter table public.arkid_cloud_snapshots enable row level security;
alter table public.arkid_cloud_snapshot_history enable row level security;
revoke all on public.arkid_cloud_snapshots, public.arkid_cloud_snapshot_history from public, anon, authenticated;
grant select on public.arkid_cloud_snapshots, public.arkid_cloud_snapshot_history to authenticated;
create policy snapshots_read_own on public.arkid_cloud_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy history_read_own on public.arkid_cloud_snapshot_history for select to authenticated using ((select auth.uid()) = user_id);

create function public.arkid_save_snapshot(expected_user uuid, expected_revision uuid, snapshot jsonb)
returns public.arkid_cloud_snapshots language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  old_row public.arkid_cloud_snapshots;
  new_row public.arkid_cloud_snapshots;
  item record;
  n integer := 0;
begin
  if uid is null or uid is distinct from expected_user then raise exception 'account changed' using errcode = '42501'; end if;
  if snapshot is null or jsonb_typeof(snapshot) is distinct from 'object'
    or snapshot->'schema' is distinct from '1'::jsonb
    or jsonb_typeof(snapshot->'storage') is distinct from 'object'
    or octet_length(snapshot::text) > 2097152
    or (snapshot - 'schema' - 'storage') <> '{}'::jsonb then
    raise exception 'invalid snapshot' using errcode = '22023';
  end if;
  for item in select key, value from pg_catalog.jsonb_each(snapshot->'storage') loop
    n := n + 1;
    if n > 1000 or jsonb_typeof(item.value) <> 'string' or not (
      item.key = any(string_to_array('arcade_profile arcade_points arcade_points_history arcade_earn_claimed arcade_daily_streak_hub arcade_inventory arcade_equipped arcade_xp_boost arcade_streak_freezes arcade_secret_unlocks arcade_quests arcade_weekly_bosses arcade_tournament_active arcade_tournaments arcade_plays arcade_last arcade_stats arcade_achievements arcade_sound arcade_streak7_given arcade_streak30_given arcade_streak7_points_given arcade_streak30_points_given arcade_last_daily_visit arcade_crt_enabled arcade_settings arcade_theme arcade_rotating arcade_last_spin arcade_favorites arcade_challenges arcade_pet arcade_showcase arcade_shortcuts arcade_onboarded arcade_notification_seen arcade_event_active arcade_weekly_rare arcade_gamepad_config arcade_lb_ arcade_points_feedback arcade_xp_feedback arcade_pending_level arcade_reward_pending arcade_tournament_result_pending arcade_channel_pending arcade_gotd_active', ' '))
      or item.key ~ '^(2048_(settings_v1|achievements_v1|stats_v1|daily_seed|highscores_v1|last_name)|ast_(settings_v1|achv_v1|stats_v1|scores_v1|last_name)|bk_(settings_v1|achv_v1|stats_v1|highscores_v1|last_name)|mk_(settings_v1|achievements_v1|stats_v1|highscores_v1|last_name|tut_seen)|mp_(settings_v1|achievements_v1|stats_v1|highscores_v1|progress_v1|last_name|tut_seen)|rr_(settings_v3|achv_v3|stats_v3|highscores_v3|last_name|tut_seen|pacman_settings_v1|pacman_achv_v1|pacman_stats_v1|pacman_highscores_v1)|pong_(settings_v1|achv_v1|stats_v1|highscores_v1|last_name)|snake_(settings_v1|achv_v1|stats_v1|hs_v1)|si_(settings_v1|scores_v1|achv_v1)|tr_(settings_v1|achv_v1|stats_v1|highscores_v1|last_name)|arcade-runner_(settings_v1|progress_v1|stats_v1|achievements_v1|highscores_v1|inventory_v1|last_name|daily_seed_v1)|ar_tutorial_v2_steps|GameRunnerSave)$'
      or item.key ~ '^arcade_(top|playcount|added|bosses|lootbox_count|lb)_[a-zA-Z0-9_-]+$'
    ) then raise exception 'invalid snapshot' using errcode = '22023'; end if;
  end loop;
  if n = 0 then raise exception 'invalid snapshot' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select * into old_row from public.arkid_cloud_snapshots where user_id = uid;
  if old_row.user_id is null then
    if expected_revision is not null then raise exception 'snapshot conflict' using errcode = '40001'; end if;
    insert into public.arkid_cloud_snapshots(user_id, revision, data)
      values (uid, pg_catalog.gen_random_uuid(), snapshot) returning * into new_row;
  else
    if expected_revision is distinct from old_row.revision then raise exception 'snapshot conflict' using errcode = '40001'; end if;
    -- Never silently delete recovery history. Once full, stop and request an explicit retention decision.
    if (select count(*) from public.arkid_cloud_snapshot_history where user_id = uid) >= 20 then
      raise exception 'snapshot history full' using errcode = '54000';
    end if;
    insert into public.arkid_cloud_snapshot_history(user_id, revision, data, updated_at)
      values (uid, old_row.revision, old_row.data, old_row.updated_at);
    update public.arkid_cloud_snapshots set revision = pg_catalog.gen_random_uuid(), data = snapshot, updated_at = now()
      where user_id = uid returning * into new_row;
  end if;
  return new_row;
end;
$$;
revoke all on function public.arkid_save_snapshot(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.arkid_save_snapshot(uuid, uuid, jsonb) to authenticated;
