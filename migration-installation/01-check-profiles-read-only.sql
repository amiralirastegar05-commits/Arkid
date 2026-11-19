-- Read only. All columns must be true. If anything is false or errors, stop.
select
  to_regclass('public.profiles') is not null as table_exists,
  coalesce((select relrowsecurity from pg_catalog.pg_class where oid=to_regclass('public.profiles')), false) as rls_enabled,
  (select count(*) = 2 from pg_catalog.pg_policies where schemaname='public' and tablename='profiles') as exactly_two_policies,
  exists (select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own' and cmd='SELECT' and roles = array['authenticated']::name[]) as select_policy_exists,
  exists (select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own' and cmd='UPDATE' and roles = array['authenticated']::name[]) as update_policy_exists,
  exists (select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace join pg_catalog.pg_proc p on p.oid=t.tgfoid join pg_catalog.pg_namespace fn on fn.oid=p.pronamespace where n.nspname='auth' and c.relname='users' and t.tgname='arkid_create_profile' and t.tgenabled in ('O','A') and t.tgtype=5 and fn.nspname='public' and p.proname='arkid_create_profile' and p.prosecdef) as auth_trigger_exists,
  exists (select 1 from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='profiles' and t.tgname='arkid_profile_updated_at' and t.tgenabled in ('O','A') and t.tgtype=19) as update_trigger_exists,
  to_regclass('public.profiles_username_lower_unique') is not null as username_index_exists;
