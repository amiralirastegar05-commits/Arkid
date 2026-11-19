-- Read only. All columns must be true. If anything is false or errors, stop.
select
  (select count(*) = 0 from auth.users) as no_auth_users,
  not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','S','f')) as public_empty,
  not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('profiles','profiles_pkey','profiles_username_lower_unique','arkid_cloud_snapshots','arkid_cloud_snapshots_pkey','arkid_cloud_snapshot_history','arkid_cloud_snapshot_history_pkey')) as relation_names_free,
  not exists (select 1 from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname in ('profiles','arkid_cloud_snapshots','arkid_cloud_snapshot_history')) as type_names_free,
  not exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('arkid_create_profile','arkid_profile_updated_at','arkid_save_snapshot')) as function_names_free,
  not exists (select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth' and c.relname='users' and not t.tgisinternal) as no_auth_user_triggers,
  to_regprocedure('auth.uid()') is not null and to_regprocedure('pg_catalog.gen_random_uuid()') is not null
    and to_regprocedure('pg_catalog.hashtextextended(text,bigint)') is not null as required_functions_exist,
  exists (select 1 from pg_catalog.pg_roles where rolname='anon') and exists (select 1 from pg_catalog.pg_roles where rolname='authenticated') as roles_exist,
  not exists (select 1 from pg_catalog.pg_roles where rolname in ('anon','authenticated') and (rolsuper or rolbypassrls)) as web_roles_do_not_bypass_rls,
  not exists (select 1 from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid=m.member where r.rolname in ('anon','authenticated')) as web_roles_have_no_extra_memberships,
  has_schema_privilege('authenticated','public','USAGE') and has_schema_privilege('authenticated','auth','USAGE') and has_function_privilege('authenticated','auth.uid()','EXECUTE') as authenticated_dependencies,
  exists (select 1 from pg_catalog.pg_language where lanname='plpgsql') as plpgsql_available,
  has_schema_privilege(current_user,'public','CREATE') and has_table_privilege(current_user,'auth.users','TRIGGER')
    and has_table_privilege(current_user,'auth.users','REFERENCES') as executor_has_ddl_privileges,
  exists (select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='id' and data_type='uuid')
    and exists (select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='raw_user_meta_data' and data_type='jsonb') as auth_columns_match;
