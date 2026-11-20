-- Private per-account monthly total. It is not a client score submission path.
-- The same per-account request budget is shared with the public leaderboard.
create function public.arkid_my_monthly_points(period date default null)
returns table(month_utc date,points bigint)
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); limit_row public.arkid_rank_read_rate; current_month date := pg_catalog.date_trunc('month',pg_catalog.clock_timestamp() at time zone 'UTC')::date;
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  period:=coalesce(period,current_month);
  if period<>pg_catalog.date_trunc('month',period::timestamp)::date or period>current_month then raise exception 'invalid_period' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rank-read:' || uid::text,0));
  select * into limit_row from public.arkid_rank_read_rate r where r.user_id=uid;
  if limit_row.user_id is null then
    insert into public.arkid_rank_read_rate(user_id,window_start,request_count) values(uid,pg_catalog.clock_timestamp(),1);
  elsif limit_row.window_start<=pg_catalog.clock_timestamp()-interval '1 minute' then
    update public.arkid_rank_read_rate r set window_start=pg_catalog.clock_timestamp(),request_count=1 where r.user_id=uid;
  elsif limit_row.request_count>=30 then raise exception 'rank_rate_limited' using errcode='54000';
  else update public.arkid_rank_read_rate r set request_count=r.request_count+1 where r.user_id=uid; end if;
  return query select period,coalesce(pg_catalog.sum(e.points),0)::bigint from public.arkid_rank_events e where e.user_id=uid and e.month_utc=period;
end; $$;
revoke all on function public.arkid_my_monthly_points(date) from public,anon,authenticated;
grant execute on function public.arkid_my_monthly_points(date) to authenticated;
