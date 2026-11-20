import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
async function setup(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const f of ['003_public_profiles.sql','006_monthly_ranking.sql','008_ranked_sessions.sql'])await db.exec(await readFile(new URL('../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
 for(let n=1;n<=3;n++)await db.query('insert into auth.users values($1,$2::jsonb)',[id(n),'{}']);return db;
}
test('ranked RPCs deny clients and trusted sessions commit exactly once',async()=>{
 const db=await setup();try{
  await db.exec('set role authenticated');
  for(const [sql,args] of [['select public.arkid_rank_start($1,$2,9)',[id(1),id(11)]],['select public.arkid_rank_begin_verify($1,$2)',[id(1),id(11)]],['select public.arkid_rank_commit($1,$2,100,$3)',[id(1),id(11),'L']]])await assert.rejects(db.query(sql,args),/permission denied/);
  await assert.rejects(db.query('select * from public.arkid_rank_sessions'),/permission denied/);
  await db.exec('reset role;set role service_role');
  const start=async (user,request,seed)=> (await db.query('select public.arkid_rank_start($1,$2,$3) result',[id(user),id(request),seed])).rows[0].result;
  const session=await start(1,11,9);assert.equal(session.status,'open');assert.equal(Number(session.seed),9);
  assert.equal((await start(1,11,55)).id,session.id);assert.equal((await start(1,12,55)).id,session.id);
  await assert.rejects(db.query('select public.arkid_rank_begin_verify($1,$2)',[id(2),session.id]),/session_unavailable/);
  await assert.rejects(db.query('select public.arkid_rank_commit($1,$2,100,$3)',[id(1),session.id,'L']),/invalid_result/);
  await db.query('select public.arkid_rank_begin_verify($1,$2)',[id(1),session.id]);
  await assert.rejects(db.query('select public.arkid_rank_commit($1,$2,100,$3)',[id(1),session.id,'X']),/invalid_result/);
  const done=(await db.query('select public.arkid_rank_commit($1,$2,100,$3) result',[id(1),session.id,'LR'])).rows[0].result;
  assert.equal(done.status,'completed');assert.equal(done.points,100);
  const again=(await db.query('select public.arkid_rank_commit($1,$2,999,$3) result',[id(1),session.id,'U'])).rows[0].result;assert.equal(again.points,100);
  assert.equal((await db.query('select public.arkid_rank_begin_verify($1,$2) result',[id(1),session.id])).rows[0].result.points,100);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.arkid_rank_events')).rows[0].n,1);
  assert.equal((await db.query('select transcript from public.arkid_rank_sessions where id=$1',[session.id])).rows[0].transcript,'LR');
 }finally{await db.close()}
});

test('sessions enforce attempt cap, expiry, seed range and five UTC starts',async()=>{
 const db=await setup();try{
  await db.exec('set role service_role');
  const start=async (r,seed=1)=>(await db.query('select public.arkid_rank_start($1,$2,$3) result',[id(1),id(r),seed])).rows[0].result;
  await assert.rejects(start(11,-1),/invalid_request/);
  const s=await start(11);
  for(let i=0;i<3;i++)await db.query('select public.arkid_rank_begin_verify($1,$2)',[id(1),s.id]);
  await assert.rejects(db.query('select public.arkid_rank_begin_verify($1,$2)',[id(1),s.id]),/rank_attempt_limit/);
  await db.exec('reset role');await db.query("update public.arkid_rank_sessions set started_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' where id=$1",[s.id]);
  await db.exec('set role service_role');await assert.rejects(db.query('select public.arkid_rank_begin_verify($1,$2)',[id(1),s.id]),/session_expired/);
  await assert.rejects(db.query('select public.arkid_rank_commit($1,$2,10,$3)',[id(1),s.id,'L']),/session_expired/);
  // Arrange five completed fixtures in today's UTC period without relying on
  // the wall-clock position relative to midnight.
  await db.exec('reset role');await db.query("update public.arkid_rank_sessions set started_at=clock_timestamp(),expires_at=clock_timestamp()+interval '1 hour',status='completed',points=1,transcript='L',completed_at=clock_timestamp() where user_id=$1",[id(1)]);
  for(let n=12;n<=15;n++)await db.query("insert into public.arkid_rank_sessions(user_id,request_id,seed,status,points,transcript,completed_at) values($1,$2,1,'completed',1,'L',clock_timestamp())",[id(1),id(n)]);
  await db.exec('set role service_role');await assert.rejects(start(17),/rank_daily_limit/);
 }finally{await db.close()}
});
