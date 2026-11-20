import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('initial rollout hold prevents client reporting without disabling invitation blocks',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const f of ['003_public_profiles.sql','004_teams_and_discovery.sql','007_social_safety.sql'])await db.exec(await readFile(new URL('../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
  const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
  await db.query('insert into auth.users(id) values($1),($2)',[a,b]);
  await db.query('insert into public.arkid_public_profiles(user_id,display_name,is_public) values($1,$2,true),($3,$4,true)',[a,'Alice',b,'Bob']);
  await db.exec(await readFile(new URL('../supabase/new-project/rollout/hold_reporting.sql',import.meta.url),'utf8'));
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
  await assert.rejects(db.query("select public.arkid_report_profile($1,'spam')",[b]),/permission denied/);
  await assert.rejects(db.query("select public.arkid_report_team(null,$1,'spam')",[b]),/permission denied/);
  assert.equal((await db.query('select public.arkid_set_player_block($1,true) result',[b])).rows[0].result,'blocked');
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.arkid_social_reports')).rows[0].n,0);
 }finally{await db.close()}
});
