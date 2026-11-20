-- Social safety foundation. Additive only; no existing invitations, teams,
-- profiles or game data are deleted or modified. Reports require human review.
create table public.arkid_player_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (blocker_id,blocked_id),
  check (blocker_id <> blocked_id)
);
create index arkid_player_blocks_reverse on public.arkid_player_blocks(blocked_id,blocker_id) where active;
create table public.arkid_block_rate (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 0)
);
create table public.arkid_social_reports (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  -- Preserve moderation evidence if an account is removed; clear its identity.
  reporter_id uuid references auth.users(id) on delete set null,
  subject_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('harassment','inappropriate','spam','other')),
  -- Evidence is the public profile at report time, not an email or private data.
  display_name_snapshot text not null,
  bio_snapshot text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (reporter_id <> subject_id)
);
create index arkid_reports_reporter_time on public.arkid_social_reports(reporter_id,created_at desc);
create index arkid_reports_pending on public.arkid_social_reports(created_at,id) where status='pending';
create table public.arkid_team_reports (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  team_id uuid not null references public.arkid_teams(id),
  reason text not null check (reason in ('harassment','inappropriate','spam','other')),
  team_name_snapshot text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index arkid_team_reports_reporter_time on public.arkid_team_reports(reporter_id,created_at desc);
create index arkid_team_reports_pending on public.arkid_team_reports(created_at,id) where status='pending';
alter table public.arkid_team_reports enable row level security;
alter table public.arkid_player_blocks enable row level security;
alter table public.arkid_block_rate enable row level security;
alter table public.arkid_social_reports enable row level security;
revoke all on public.arkid_player_blocks,public.arkid_block_rate,public.arkid_social_reports,public.arkid_team_reports from public,anon,authenticated;

-- Every operation touching a block/invitation pair uses the same lock key,
-- regardless of direction. Client roles have no execute privilege.
create function public.arkid_lock_player_pair(a uuid,b uuid) returns void
language plpgsql set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-pair:' || least(a,b)::text || ':' || greatest(a,b)::text,0));
end; $$;
revoke all on function public.arkid_lock_player_pair(uuid,uuid) from public,anon,authenticated;

create function public.arkid_set_player_block(target uuid,blocked boolean) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); rate_row public.arkid_block_rate;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if target is null or target=uid or blocked is null then raise exception 'invalid_target' using errcode='22023'; end if;
  -- Serialize the owner's cap as well as each pair's state.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-block-owner:' || uid::text,0));
  perform public.arkid_lock_player_pair(uid,target);
  if blocked then
    if not exists(select 1 from public.arkid_public_profiles p where p.user_id=target and p.is_public)
       and not exists(select 1 from public.arkid_team_invites i where i.recipient_id=uid and i.sender_id=target and i.status='pending')
       and not exists(select 1 from public.arkid_player_blocks b where b.blocker_id=uid and b.blocked_id=target) then
      raise exception 'player_unavailable' using errcode='22023';
    end if;
    if not exists(select 1 from public.arkid_player_blocks b where b.blocker_id=uid and b.blocked_id=target and b.active)
       and (select count(*) from public.arkid_player_blocks b where b.blocker_id=uid and b.active) >= 1000 then
      raise exception 'block_limit' using errcode='54000';
    end if;
    -- Limit block writes; unblocking remains available even at the limit.
    select * into rate_row from public.arkid_block_rate r where r.user_id=uid;
    if rate_row.user_id is null then
      insert into public.arkid_block_rate(user_id,window_start,request_count) values(uid,pg_catalog.clock_timestamp(),1);
    elsif rate_row.window_start<=pg_catalog.clock_timestamp()-interval '1 hour' then
      update public.arkid_block_rate r set window_start=pg_catalog.clock_timestamp(),request_count=1 where r.user_id=uid;
    elsif rate_row.request_count>=30 then raise exception 'block_rate_limited' using errcode='54000';
    else update public.arkid_block_rate r set request_count=r.request_count+1 where r.user_id=uid; end if;
    insert into public.arkid_player_blocks(blocker_id,blocked_id,active,updated_at) values(uid,target,true,pg_catalog.clock_timestamp())
      on conflict(blocker_id,blocked_id) do update set active=true,updated_at=pg_catalog.clock_timestamp();
    return 'blocked';
  end if;
  update public.arkid_player_blocks b set active=false,updated_at=pg_catalog.clock_timestamp() where b.blocker_id=uid and b.blocked_id=target and b.active;
  return 'unblocked';
end; $$;

-- A recipient can block a sender directly from a pending invite, even if the
-- sender has no public profile. The function never exposes the sender ID.
create function public.arkid_block_invite_sender(invite uuid) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); sender uuid;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  select i.sender_id into sender from public.arkid_team_invites i where i.id=invite and i.recipient_id=uid and i.status='pending';
  if sender is null then raise exception 'invite_unavailable' using errcode='22023'; end if;
  return public.arkid_set_player_block(sender,true);
end; $$;

create function public.arkid_my_blocks()
returns table(user_id uuid,display_name text)
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  return query select b.blocked_id,coalesce(case when p.is_public then p.display_name end,'بازیکن')
    from public.arkid_player_blocks b left join public.arkid_public_profiles p on p.user_id=b.blocked_id
    where b.blocker_id=uid and b.active order by b.updated_at desc,b.blocked_id limit 1000;
end; $$;

create function public.arkid_report_profile(target uuid,report_reason text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); profile public.arkid_public_profiles;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if target is null or target=uid or report_reason is null or report_reason not in ('harassment','inappropriate','spam','other') then raise exception 'invalid_report' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-report-owner:' || uid::text,0));
  select * into profile from public.arkid_public_profiles p where p.user_id=target and p.is_public;
  if profile.user_id is null then raise exception 'player_unavailable' using errcode='22023'; end if;
  if (select count(*) from public.arkid_social_reports r where r.reporter_id=uid and r.created_at>pg_catalog.clock_timestamp()-interval '1 day') +
     (select count(*) from public.arkid_team_reports r where r.reporter_id=uid and r.created_at>pg_catalog.clock_timestamp()-interval '1 day') >= 10 then
    raise exception 'report_rate_limited' using errcode='54000';
  end if;
  if exists(select 1 from public.arkid_social_reports r where r.reporter_id=uid and r.subject_id=target and r.created_at>pg_catalog.clock_timestamp()-interval '1 day') then
    raise exception 'report_recent' using errcode='54000';
  end if;
  insert into public.arkid_social_reports(reporter_id,subject_id,reason,display_name_snapshot,bio_snapshot)
    values(uid,target,report_reason,profile.display_name,profile.bio);
  return 'reported';
end; $$;

-- A team may be reported only by a current member or the recipient of one
-- of its pending invitations. No arbitrary team enumeration is provided.
create function public.arkid_report_team(team uuid,invite uuid,report_reason text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); team_row public.arkid_teams;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if ((team is null) = (invite is null)) or report_reason is null or report_reason not in ('harassment','inappropriate','spam','other') then
    raise exception 'invalid_report' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-report-owner:' || uid::text,0));
  if team is not null then
    select t.* into team_row from public.arkid_teams t join public.arkid_team_members m on m.team_id=t.id
      where t.id=team and m.user_id=uid and m.left_at is null;
  else
    select t.* into team_row from public.arkid_teams t join public.arkid_team_invites i on i.team_id=t.id
      where i.id=invite and i.recipient_id=uid and i.status='pending';
  end if;
  if team_row.id is null then raise exception 'team_unavailable' using errcode='22023'; end if;
  if (select count(*) from public.arkid_social_reports r where r.reporter_id=uid and r.created_at>pg_catalog.clock_timestamp()-interval '1 day') +
     (select count(*) from public.arkid_team_reports r where r.reporter_id=uid and r.created_at>pg_catalog.clock_timestamp()-interval '1 day') >= 10 then
    raise exception 'report_rate_limited' using errcode='54000';
  end if;
  if exists(select 1 from public.arkid_team_reports r where r.reporter_id=uid and r.team_id=team_row.id and r.created_at>pg_catalog.clock_timestamp()-interval '1 day') then
    raise exception 'report_recent' using errcode='54000';
  end if;
  insert into public.arkid_team_reports(reporter_id,team_id,reason,team_name_snapshot) values(uid,team_row.id,report_reason,team_row.name);
  return 'reported';
end; $$;

-- Pending invites are retained; blocked pairs cannot create a new invitation
-- or accept an old one in either direction. Declining remains possible.
-- Existing team membership and ownership are never changed automatically.
create function public.arkid_guard_blocked_invitation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.sender_id is null then return new; end if;
  perform public.arkid_lock_player_pair(new.sender_id,new.recipient_id);
  if exists(select 1 from public.arkid_player_blocks b where b.active and
    ((b.blocker_id=new.sender_id and b.blocked_id=new.recipient_id) or (b.blocker_id=new.recipient_id and b.blocked_id=new.sender_id))) then
    raise exception 'player_unavailable' using errcode='22023';
  end if;
  return new;
end; $$;
revoke all on function public.arkid_guard_blocked_invitation() from public,anon,authenticated;
create trigger arkid_guard_invite_insert before insert on public.arkid_team_invites
  for each row execute function public.arkid_guard_blocked_invitation();
create trigger arkid_guard_invite_accept before update of status on public.arkid_team_invites
  for each row when (new.status='accepted' and old.status='pending') execute function public.arkid_guard_blocked_invitation();

revoke all on function public.arkid_set_player_block(uuid,boolean),public.arkid_block_invite_sender(uuid),public.arkid_my_blocks(),public.arkid_report_profile(uuid,text),public.arkid_report_team(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.arkid_set_player_block(uuid,boolean),public.arkid_block_invite_sender(uuid),public.arkid_my_blocks(),public.arkid_report_profile(uuid,text),public.arkid_report_team(uuid,uuid,text) to authenticated;
