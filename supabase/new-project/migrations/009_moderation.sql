-- Restricted human moderation. An administrator must explicitly provision a
-- moderator in arkid_moderators from a secure administrative environment.
-- No browser user can grant themselves this role or modify reports directly.
create table public.arkid_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default pg_catalog.clock_timestamp()
);
create table public.arkid_moderation_actions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  report_kind text not null check (report_kind in ('profile','team')),
  report_id uuid not null,
  previous_status text not null check (previous_status='pending'),
  new_status text not null check (new_status in ('reviewed','dismissed')),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index arkid_moderation_actions_report on public.arkid_moderation_actions(report_kind,report_id,created_at);
alter table public.arkid_moderators enable row level security;
alter table public.arkid_moderation_actions enable row level security;
revoke all on public.arkid_moderators,public.arkid_moderation_actions from public,anon,authenticated;

create function public.arkid_is_moderator() returns boolean
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign_in_required' using errcode='42501'; end if;
  return exists(select 1 from public.arkid_moderators m where m.user_id=uid);
end; $$;

-- Deliberately omit reporter identity. Evidence may contain personal text the
-- subject chose to publish, so it is visible only to authorized reviewers.
create function public.arkid_moderation_queue()
returns table(report_id uuid,kind text,reason text,subject_id uuid,name_snapshot text,bio_snapshot text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if not public.arkid_is_moderator() then raise exception 'not_moderator' using errcode='42501'; end if;
  return query select q.report_id,q.kind,q.reason,q.subject_id,q.name_snapshot,q.bio_snapshot,q.created_at from (
    select r.id report_id,'profile'::text kind,r.reason,r.subject_id,r.display_name_snapshot name_snapshot,r.bio_snapshot,r.created_at
      from public.arkid_social_reports r where r.status='pending'
    union all
    select r.id,'team'::text,r.reason,r.team_id,r.team_name_snapshot,''::text,r.created_at
      from public.arkid_team_reports r where r.status='pending'
  ) q order by q.created_at,q.report_id limit 50;
end; $$;

-- A review records the outcome and an audit event in the same transaction.
-- This does NOT delete, hide, ban, change membership or punish anyone.
create function public.arkid_moderation_resolve(kind text,report uuid,outcome text) returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); previous text;
begin
  if not public.arkid_is_moderator() then raise exception 'not_moderator' using errcode='42501'; end if;
  if kind is null or kind not in ('profile','team') or report is null or outcome is null or outcome not in ('reviewed','dismissed') then
    raise exception 'invalid_review' using errcode='22023';
  end if;
  if kind='profile' then
    select r.status into previous from public.arkid_social_reports r where r.id=report for update;
    if previous is distinct from 'pending' then raise exception 'report_unavailable' using errcode='22023'; end if;
    update public.arkid_social_reports r set status=outcome where r.id=report;
  else
    select r.status into previous from public.arkid_team_reports r where r.id=report for update;
    if previous is distinct from 'pending' then raise exception 'report_unavailable' using errcode='22023'; end if;
    update public.arkid_team_reports r set status=outcome where r.id=report;
  end if;
  insert into public.arkid_moderation_actions(actor_id,report_kind,report_id,previous_status,new_status) values(uid,kind,report,previous,outcome);
  return outcome;
end; $$;
revoke all on function public.arkid_is_moderator(),public.arkid_moderation_queue(),public.arkid_moderation_resolve(text,uuid,text) from public,anon,authenticated;
grant execute on function public.arkid_is_moderator(),public.arkid_moderation_queue(),public.arkid_moderation_resolve(text,uuid,text) to authenticated;
