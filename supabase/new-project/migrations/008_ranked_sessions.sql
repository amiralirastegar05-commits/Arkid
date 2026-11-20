-- Isolated ranked 2048 sessions. This migration only adds objects. It is inert
-- without a separately reviewed, authenticated trusted verifier. The browser
-- must never hold the privileged key used to call the functions below.
create table public.arkid_rank_sessions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  seed bigint not null check (seed between 0 and 4294967295),
  rules_version text not null default '2048-v1' check (rules_version='2048-v1'),
  status text not null default 'open' check (status in ('open','completed')),
  started_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null default (pg_catalog.clock_timestamp() + interval '1 hour'),
  attempts integer not null default 0 check (attempts between 0 and 3),
  points integer check (points between 1 and 1000000),
  transcript text check (pg_catalog.char_length(transcript) between 1 and 4096 and transcript ~ '^[LRUD]+$'),
  completed_at timestamptz,
  unique(user_id,request_id),
  check (expires_at > started_at),
  check ((status='open' and points is null and transcript is null and completed_at is null) or
         (status='completed' and points is not null and transcript is not null and completed_at is not null))
);
create index arkid_rank_sessions_player_time on public.arkid_rank_sessions(user_id,started_at desc);
alter table public.arkid_rank_sessions enable row level security;
revoke all on public.arkid_rank_sessions from public,anon,authenticated;

-- Internal helper for RPC output. Server-generated timestamps and seed only;
-- exposes neither stored transcript nor any account info besides the owner id.
create function public.arkid_rank_session_json(s public.arkid_rank_sessions) returns jsonb
language sql stable set search_path='' as $$
  select pg_catalog.jsonb_build_object('id',s.id,'userId',s.user_id,'seed',s.seed,
    'rulesVersion',s.rules_version,'status',s.status,'issuedAt',floor(extract(epoch from s.started_at)*1000)::bigint,
    'expiresAt',floor(extract(epoch from s.expires_at)*1000)::bigint,'points',s.points)
$$;
revoke all on function public.arkid_rank_session_json(public.arkid_rank_sessions) from public,anon,authenticated,service_role;

-- A caller must be the trusted verifier, which has already authenticated player.
-- Requests are idempotent per account and at most one unexpired game is active.
-- Five sessions per UTC day is a conservative provisional competition rule.
create function public.arkid_rank_start(player uuid,request_id uuid,random_seed bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare session_row public.arkid_rank_sessions; now_time timestamptz := pg_catalog.clock_timestamp();
begin
  if player is null or request_id is null or random_seed is null or random_seed not between 0 and 4294967295 then raise exception 'invalid_request' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rank-session:'||player::text,0));
  select * into session_row from public.arkid_rank_sessions s where s.user_id=player and s.request_id=arkid_rank_start.request_id;
  if session_row.id is not null then return public.arkid_rank_session_json(session_row); end if;
  select * into session_row from public.arkid_rank_sessions s where s.user_id=player and s.status='open' and s.expires_at>now_time order by s.started_at desc limit 1;
  if session_row.id is not null then return public.arkid_rank_session_json(session_row); end if;
  if (select count(*) from public.arkid_rank_sessions s where s.user_id=player and (s.started_at at time zone 'UTC')::date=(now_time at time zone 'UTC')::date)>=5 then
    raise exception 'rank_daily_limit' using errcode='54000';
  end if;
  insert into public.arkid_rank_sessions(user_id,request_id,seed,started_at,expires_at)
    values(player,request_id,random_seed,now_time,now_time+interval '1 hour') returning * into session_row;
  return public.arkid_rank_session_json(session_row);
end; $$;

-- Reserve a verification attempt transactionally before doing CPU work.
-- A finished session is safe to return again to support an ambiguous retry.
create function public.arkid_rank_begin_verify(player uuid,session_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.arkid_rank_sessions;
begin
  if player is null or session_id is null then raise exception 'session_unavailable' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rank-session:'||player::text,0));
  select * into s from public.arkid_rank_sessions x where x.id=session_id and x.user_id=player for update;
  if s.id is null then raise exception 'session_unavailable' using errcode='22023'; end if;
  if s.status='completed' then return public.arkid_rank_session_json(s); end if;
  if s.expires_at<=pg_catalog.clock_timestamp() then raise exception 'session_expired' using errcode='22023'; end if;
  if s.attempts>=3 then raise exception 'rank_attempt_limit' using errcode='54000'; end if;
  update public.arkid_rank_sessions x set attempts=x.attempts+1 where x.id=s.id returning * into s;
  return public.arkid_rank_session_json(s);
end; $$;

-- Only the trusted verifier may call this after replaying the entire transcript.
-- Atomic row lock + unique source event make repeated/concurrent commits safe.
-- PostgreSQL server time, not the browser clock, determines the scoring month.
create function public.arkid_rank_commit(player uuid,session_id uuid,verified_points integer,verified_transcript text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.arkid_rank_sessions; now_time timestamptz;
begin
  if player is null or session_id is null then raise exception 'session_unavailable' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rank-session:'||player::text,0));
  select * into s from public.arkid_rank_sessions x where x.id=session_id and x.user_id=player for update;
  if s.id is null then raise exception 'session_unavailable' using errcode='22023'; end if;
  if s.status='completed' then return public.arkid_rank_session_json(s); end if;
  now_time:=pg_catalog.clock_timestamp();
  if s.expires_at<=now_time then raise exception 'session_expired' using errcode='22023'; end if;
  if s.attempts<1 or verified_points is null or verified_points not between 1 and 1000000 or verified_transcript is null or pg_catalog.char_length(verified_transcript) not between 1 and 4096 or verified_transcript !~ '^[LRUD]+$' then
    raise exception 'invalid_result' using errcode='22023';
  end if;
  insert into public.arkid_rank_events(user_id,source,source_event_id,points,occurred_at)
    values(player,'verified_2048',s.id::text,verified_points,now_time);
  update public.arkid_rank_sessions x set status='completed',points=verified_points,transcript=verified_transcript,completed_at=now_time where x.id=s.id returning * into s;
  return public.arkid_rank_session_json(s);
end; $$;
revoke all on function public.arkid_rank_start(uuid,uuid,bigint),public.arkid_rank_begin_verify(uuid,uuid),public.arkid_rank_commit(uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.arkid_rank_start(uuid,uuid,bigint),public.arkid_rank_begin_verify(uuid,uuid),public.arkid_rank_commit(uuid,uuid,integer,text) to service_role;
