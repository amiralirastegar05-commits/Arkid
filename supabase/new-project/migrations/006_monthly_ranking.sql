-- Ranking foundation only. No authenticated client can submit or edit scores.
-- A future trusted verifier must validate game results before inserting events.
-- Existing local XP, coins, snapshots and prior progress are not consulted.
create table public.arkid_rank_events (
  event_id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null check (source in ('verified_2048')),
  source_event_id text not null check (char_length(source_event_id) between 1 and 128),
  points integer not null check (points between 1 and 1000000),
  occurred_at timestamptz not null default pg_catalog.clock_timestamp(),
  month_utc date generated always as (pg_catalog.date_trunc('month',occurred_at at time zone 'UTC')::date) stored,
  unique(source,source_event_id)
);
create index arkid_rank_month_user on public.arkid_rank_events(month_utc,user_id);
create table public.arkid_rank_read_rate (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 0)
);
alter table public.arkid_rank_events enable row level security;
alter table public.arkid_rank_read_rate enable row level security;
revoke all on public.arkid_rank_events,public.arkid_rank_read_rate from public,anon,authenticated;

-- Public opt-in is required for appearance in the board, even for a verified
-- event. Periods are UTC calendar months; old periods remain in the ledger.
create function public.arkid_monthly_leaderboard(period date default null)
returns table(place bigint,user_id uuid,display_name text,points bigint)
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); limit_row public.arkid_rank_read_rate; current_month date := pg_catalog.date_trunc('month',pg_catalog.clock_timestamp() at time zone 'UTC')::date;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  period := coalesce(period,current_month);
  if period <> pg_catalog.date_trunc('month',period::timestamp)::date or period>current_month then raise exception 'invalid_period' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rank-read:' || uid::text,0));
  select * into limit_row from public.arkid_rank_read_rate r where r.user_id=uid;
  if limit_row.user_id is null then
    insert into public.arkid_rank_read_rate(user_id,window_start,request_count) values(uid,pg_catalog.clock_timestamp(),1);
  elsif limit_row.window_start <= pg_catalog.clock_timestamp()-interval '1 minute' then
    update public.arkid_rank_read_rate r set window_start=pg_catalog.clock_timestamp(),request_count=1 where r.user_id=uid;
  elsif limit_row.request_count >= 30 then raise exception 'rank_rate_limited' using errcode='54000';
  else update public.arkid_rank_read_rate r set request_count=r.request_count+1 where r.user_id=uid; end if;
  return query
    with totals as (
      select e.user_id, pg_catalog.sum(e.points)::bigint score, pg_catalog.max(e.occurred_at) last_event
      from public.arkid_rank_events e where e.month_utc=period and e.user_id is not null group by e.user_id
    ), visible as (
      select totals.user_id,p.display_name,totals.score,totals.last_event
      from totals join public.arkid_public_profiles p on p.user_id=totals.user_id where p.is_public
    )
    select pg_catalog.row_number() over (order by v.score desc,v.last_event asc,v.user_id asc),v.user_id,v.display_name,v.score
      from visible v order by v.score desc,v.last_event asc,v.user_id asc limit 50;
end; $$;
revoke all on function public.arkid_monthly_leaderboard(date) from public,anon,authenticated;
grant execute on function public.arkid_monthly_leaderboard(date) to authenticated;
