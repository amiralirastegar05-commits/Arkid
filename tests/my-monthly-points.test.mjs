import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
test('players privately see only their own monthly points independently of public visibility',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const f of ['003_public_profiles.sql','006_monthly_ranking.sql','010_my_monthly_points.sql'])await db.exec(await readFile(new URL('../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
  for(let n=1;n<=2;n++)await db.query('insert into auth.users values($1,$2::jsonb)',[id(n),'{}']);
  await db.query("insert into public.arkid_rank_events(user_id,source,source_event_id,points,occurred_at) values($1,'verified_2048','a',600,'2025-03-01 00:00+00'),($1,'verified_2048','b',700,'2025-03-30 00:00+00'),($2,'verified_2048','c',9000,'2025-03-01 00:00+00'),($1,'verified_2048','d',50,'2025-04-01 00:00+00')",[id(1),id(2)]);
  await db.exec('set role authenticated');const as=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);
  await as(1);assert.equal(Number((await db.query("select * from public.arkid_my_monthly_points('2025-03-01')")).rows[0].points),1300);
  assert.equal(Number((await db.query("select * from public.arkid_my_monthly_points('2025-04-01')")).rows[0].points),50);
  await as(2);assert.equal(Number((await db.query("select * from public.arkid_my_monthly_points('2025-03-01')")).rows[0].points),9000);
  await assert.rejects(db.query("select * from public.arkid_my_monthly_points('2025-03-02')"),/invalid_period/);
  await assert.rejects(db.query('select * from public.arkid_rank_events'),/permission denied/);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.arkid_my_monthly_points()'),/permission denied/);
 }finally{await db.close()}
});
