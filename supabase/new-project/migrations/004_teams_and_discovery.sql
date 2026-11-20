-- Additive social phase 2. No existing game or profile rows are modified.
-- All mutations below go through narrowly scoped functions; no direct writes.
create table public.arkid_teams (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 32),
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index arkid_teams_creator_time on public.arkid_teams(created_by,created_at desc);
create table public.arkid_team_members (
  team_id uuid not null references public.arkid_teams(id),
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default pg_catalog.clock_timestamp(),
  left_at timestamptz
);
create unique index arkid_one_active_team_per_player on public.arkid_team_members(user_id) where left_at is null;
create table public.arkid_team_invites (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  team_id uuid not null references public.arkid_teams(id),
  sender_id uuid references auth.users(id) on delete set null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  responded_at timestamptz
);
create unique index arkid_invites_one_pending_per_team on public.arkid_team_invites(team_id,recipient_id) where status='pending';
create index arkid_invites_recipient on public.arkid_team_invites(recipient_id,created_at desc);
create index arkid_invites_sender on public.arkid_team_invites(sender_id,created_at desc);
create table public.arkid_search_rate (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 0)
);

alter table public.arkid_teams enable row level security;
alter table public.arkid_team_members enable row level security;
alter table public.arkid_team_invites enable row level security;
alter table public.arkid_search_rate enable row level security;
revoke all on public.arkid_teams, public.arkid_team_members, public.arkid_team_invites, public.arkid_search_rate from public, anon, authenticated;
grant select on public.arkid_teams, public.arkid_team_members, public.arkid_team_invites to authenticated;
create policy arkid_members_read_own on public.arkid_team_members for select to authenticated using (user_id=(select auth.uid()));
create policy arkid_team_read_member on public.arkid_teams for select to authenticated using (exists (select 1 from public.arkid_team_members m where m.team_id=id and m.user_id=(select auth.uid()) and m.left_at is null));
create policy arkid_invite_read_party on public.arkid_team_invites for select to authenticated using ((select auth.uid()) in (sender_id,recipient_id));

-- These routines expose only explicitly public profiles and require login.
-- 30 searches/minute/account and 20 results/search; limits do not prevent
-- distributed abuse, so production also needs monitoring and moderation.
create function public.arkid_search_players(query_text text)
returns table(user_id uuid,display_name text,bio text)
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); q text := trim(query_text); row_limit public.arkid_search_rate;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if q is null or char_length(q) < 2 or char_length(q) > 40 then raise exception 'invalid_search' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-search:' || uid::text,0));
  select * into row_limit from public.arkid_search_rate r where r.user_id=uid;
  if row_limit.user_id is null then
    insert into public.arkid_search_rate(user_id,window_start,request_count) values(uid,pg_catalog.clock_timestamp(),1);
  elsif row_limit.window_start <= pg_catalog.clock_timestamp() - interval '1 minute' then
    update public.arkid_search_rate r set window_start=pg_catalog.clock_timestamp(), request_count=1 where r.user_id=uid;
  elsif row_limit.request_count >= 30 then
    raise exception 'search_rate_limited' using errcode='54000';
  else
    update public.arkid_search_rate r set request_count=r.request_count+1 where r.user_id=uid;
  end if;
  return query select p.user_id,p.display_name,p.bio from public.arkid_public_profiles p
    where p.is_public and p.user_id<>uid and pg_catalog.strpos(pg_catalog.lower(p.display_name),pg_catalog.lower(q))>0
    order by p.display_name,p.user_id limit 20;
end; $$;

create function public.arkid_create_team(team_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); team uuid; clean_name text := trim(team_name);
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if clean_name is null or char_length(clean_name) not between 2 and 32 then raise exception 'invalid_team_name' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-user:' || uid::text,0));
  if exists(select 1 from public.arkid_team_members m where m.user_id=uid and m.left_at is null) then raise exception 'already_in_team' using errcode='23505'; end if;
  if (select count(*) from public.arkid_teams t where t.created_by=uid and t.created_at>pg_catalog.clock_timestamp()-interval '1 day') >= 3 then raise exception 'team_creation_limited' using errcode='54000'; end if;
  insert into public.arkid_teams(name,owner_id,created_by) values(clean_name,uid,uid) returning id into team;
  insert into public.arkid_team_members(team_id,user_id) values(team,uid);
  return team;
end; $$;

create function public.arkid_invite_player(team uuid, target uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); invite_id uuid;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if target is null or target=uid then raise exception 'invalid_target' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-team:' || team::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-user:' || target::text,0));
  if not exists(select 1 from public.arkid_teams t join public.arkid_team_members m on m.team_id=t.id and m.user_id=uid and m.left_at is null where t.id=team and t.owner_id=uid) then raise exception 'not_team_owner' using errcode='42501'; end if;
  if not exists(select 1 from public.arkid_public_profiles p where p.user_id=target and p.is_public) then raise exception 'player_unavailable' using errcode='22023'; end if;
  if exists(select 1 from public.arkid_team_members m where m.user_id=target and m.left_at is null) then raise exception 'player_unavailable' using errcode='22023'; end if;
  if (select count(*) from public.arkid_team_members m where m.team_id=team and m.left_at is null) >= 20 then raise exception 'team_full' using errcode='54000'; end if;
  if (select count(*) from public.arkid_team_invites i where i.sender_id=uid and i.created_at > pg_catalog.clock_timestamp()-interval '1 hour') >= 15 then raise exception 'invite_rate_limited' using errcode='54000'; end if;
  if (select count(*) from public.arkid_team_invites i where i.recipient_id=target and i.status='pending') >= 3 then raise exception 'player_unavailable' using errcode='54000'; end if;
  if exists(select 1 from public.arkid_team_invites i where i.team_id=team and i.recipient_id=target and i.created_at > pg_catalog.clock_timestamp()-interval '1 day') then raise exception 'invite_recent' using errcode='54000'; end if;
  insert into public.arkid_team_invites(team_id,sender_id,recipient_id) values(team,uid,target) returning id into invite_id;
  return invite_id;
end; $$;

create function public.arkid_respond_team_invite(invite uuid, accept_invite boolean)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); row_invite public.arkid_team_invites; next_status text;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if accept_invite is null then raise exception 'invalid_response' using errcode='22023'; end if;
  select * into row_invite from public.arkid_team_invites i where i.id=invite and i.recipient_id=uid;
  if row_invite.id is null then raise exception 'invite_unavailable' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-team:' || row_invite.team_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-user:' || uid::text,0));
  select * into row_invite from public.arkid_team_invites i where i.id=invite and i.recipient_id=uid for update;
  if row_invite.status <> 'pending' then raise exception 'invite_unavailable' using errcode='22023'; end if;
  if accept_invite then
    if exists(select 1 from public.arkid_team_members m where m.user_id=uid and m.left_at is null) then raise exception 'already_in_team' using errcode='23505'; end if;
    if (select count(*) from public.arkid_team_members m where m.team_id=row_invite.team_id and m.left_at is null) >= 20 then raise exception 'team_full' using errcode='54000'; end if;
    if not exists(select 1 from public.arkid_teams t where t.id=row_invite.team_id and t.owner_id is not null) then raise exception 'team_unavailable' using errcode='22023'; end if;
    insert into public.arkid_team_members(team_id,user_id) values(row_invite.team_id,uid);
    next_status := 'accepted';
  else next_status := 'declined'; end if;
  update public.arkid_team_invites i set status=next_status,responded_at=pg_catalog.clock_timestamp() where i.id=invite;
  return next_status;
end; $$;

create function public.arkid_team_inbox()
returns table(invite_id uuid,team_name text,sender_name text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  return query select i.id,t.name,coalesce(case when p.is_public then p.display_name end,'بازیکن'),i.created_at
    from public.arkid_team_invites i join public.arkid_teams t on t.id=i.team_id
    left join public.arkid_public_profiles p on p.user_id=i.sender_id
    where i.recipient_id=uid and i.status='pending' order by i.created_at desc limit 50;
end; $$;

create function public.arkid_my_team()
returns table(team_id uuid,team_name text,owner_id uuid,members jsonb)
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  return query select t.id,t.name,t.owner_id,
    (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('user_id',m.user_id,'display_name',coalesce(case when p.is_public or m.user_id=uid then p.display_name end,'بازیکن')) order by m.joined_at,m.user_id)
     from public.arkid_team_members m left join public.arkid_public_profiles p on p.user_id=m.user_id where m.team_id=t.id and m.left_at is null)
    from public.arkid_teams t join public.arkid_team_members mine on mine.team_id=t.id and mine.user_id=uid and mine.left_at is null;
end; $$;

-- Leaving retains membership history. An owner must transfer ownership before
-- leaving an occupied team; an empty team is retained with no owner.
create function public.arkid_leave_team()
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); team uuid; owner uuid;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  select m.team_id into team from public.arkid_team_members m where m.user_id=uid and m.left_at is null;
  if team is null then raise exception 'no_team' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-team:' || team::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-user:' || uid::text,0));
  if not exists(select 1 from public.arkid_team_members m where m.team_id=team and m.user_id=uid and m.left_at is null) then raise exception 'no_team' using errcode='22023'; end if;
  select t.owner_id into owner from public.arkid_teams t where t.id=team;
  if owner=uid and (select count(*) from public.arkid_team_members m where m.team_id=team and m.left_at is null)>1 then raise exception 'transfer_required' using errcode='22023'; end if;
  if owner=uid then update public.arkid_teams t set owner_id=null where t.id=team; end if;
  update public.arkid_team_members m set left_at=pg_catalog.clock_timestamp() where m.team_id=team and m.user_id=uid and m.left_at is null;
  return 'left';
end; $$;

create function public.arkid_transfer_team_owner(target uuid)
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); team uuid;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  if target is null or target=uid then raise exception 'invalid_target' using errcode='22023'; end if;
  select m.team_id into team from public.arkid_team_members m where m.user_id=uid and m.left_at is null;
  if team is null then raise exception 'no_team' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-team:' || team::text,0));
  if not exists(select 1 from public.arkid_teams t join public.arkid_team_members m on m.team_id=t.id and m.user_id=uid and m.left_at is null where t.id=team and t.owner_id=uid) then raise exception 'not_team_owner' using errcode='42501'; end if;
  if not exists(select 1 from public.arkid_team_members m where m.team_id=team and m.user_id=target and m.left_at is null) then raise exception 'player_unavailable' using errcode='22023'; end if;
  update public.arkid_teams t set owner_id=target where t.id=team;
  return 'transferred';
end; $$;

-- If an owner deletes their account, the team is preserved with no owner.
-- An existing member can explicitly claim an ownerless team; nobody is
-- promoted or deleted automatically.
create function public.arkid_claim_team_owner()
returns text language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); team uuid;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  select m.team_id into team from public.arkid_team_members m where m.user_id=uid and m.left_at is null;
  if team is null then raise exception 'no_team' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social-team:' || team::text,0));
  if not exists(select 1 from public.arkid_team_members m where m.team_id=team and m.user_id=uid and m.left_at is null) then raise exception 'no_team' using errcode='22023'; end if;
  update public.arkid_teams t set owner_id=uid where t.id=team and t.owner_id is null;
  if not found then raise exception 'owner_exists' using errcode='22023'; end if;
  return 'claimed';
end; $$;

revoke all on function public.arkid_search_players(text), public.arkid_create_team(text), public.arkid_invite_player(uuid,uuid), public.arkid_respond_team_invite(uuid,boolean), public.arkid_team_inbox(), public.arkid_my_team(), public.arkid_leave_team(), public.arkid_transfer_team_owner(uuid), public.arkid_claim_team_owner() from public, anon, authenticated;
grant execute on function public.arkid_search_players(text), public.arkid_create_team(text), public.arkid_invite_player(uuid,uuid), public.arkid_respond_team_invite(uuid,boolean), public.arkid_team_inbox(), public.arkid_my_team(), public.arkid_leave_team(), public.arkid_transfer_team_owner(uuid), public.arkid_claim_team_owner() to authenticated;
