import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {buildSocialStage} from '../supabase/new-project/build-social-stage.mjs';

test('first-stage SQL installs all social migrations atomically with reporting held',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  const sql=await buildSocialStage();
  assert.doesNotMatch(sql,/create\s+table\s+public\.profiles\b/i);
  assert.ok(sql.indexOf('BEGIN 003_public_profiles.sql')<sql.indexOf('BEGIN 010_my_monthly_points.sql'));
  await db.exec('begin;\n'+sql+'\ncommit;');
  const flags=(await db.query(`select
    has_function_privilege('authenticated','public.arkid_report_profile(uuid,text)','execute') as report_profile,
    has_function_privilege('authenticated','public.arkid_report_team(uuid,uuid,text)','execute') as report_team,
    has_function_privilege('authenticated','public.arkid_set_player_block(uuid,boolean)','execute') as block,
    has_function_privilege('authenticated','public.arkid_my_team()','execute') as team,
    has_function_privilege('authenticated','public.arkid_rank_start(uuid,uuid,bigint)','execute') as rank_client,
    has_function_privilege('service_role','public.arkid_rank_start(uuid,uuid,bigint)','execute') as rank_service`)).rows[0];
  assert.deepEqual(flags,{report_profile:false,report_team:false,block:true,team:true,rank_client:false,rank_service:true});
 }finally{await db.close()}
});
