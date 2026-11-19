-- Read only. All columns must be true. If anything is false or errors, stop.
select
  to_regclass('public.arkid_cloud_snapshots') is not null as snapshot_table_exists,
  to_regclass('public.arkid_cloud_snapshot_history') is not null as history_table_exists,
  coalesce((select relrowsecurity from pg_catalog.pg_class where oid=to_regclass('public.arkid_cloud_snapshots')),false) as snapshot_rls_enabled,
  coalesce((select relrowsecurity from pg_catalog.pg_class where oid=to_regclass('public.arkid_cloud_snapshot_history')),false) as history_rls_enabled,
  (select count(*) = 1 from pg_catalog.pg_policies where schemaname='public' and tablename='arkid_cloud_snapshots') as one_snapshot_policy,
  (select count(*) = 1 from pg_catalog.pg_policies where schemaname='public' and tablename='arkid_cloud_snapshot_history') as one_history_policy,
  exists (select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='arkid_cloud_snapshots' and policyname='snapshots_read_own' and cmd='SELECT' and roles=array['authenticated']::name[]) as snapshot_policy_exists,
  exists (select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='arkid_cloud_snapshot_history' and policyname='history_read_own' and cmd='SELECT' and roles=array['authenticated']::name[]) as history_policy_exists,
  coalesce((select prosecdef from pg_catalog.pg_proc where oid=to_regprocedure('public.arkid_save_snapshot(uuid,uuid,jsonb)')),false) as save_rpc_exists_and_security_definer;
