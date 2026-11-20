import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const u=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
test('UTC ranking exposes only opted-in identities and no client score writing',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for(const f of ['003_public_profiles.sql','006_monthly_ranking.sql'])await db.exec(await readFile(new URL('../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
  for(let i=1;i<=4;i++)await db.query('insert into auth.users values($1,$2::jsonb)',[u(i),'{}']);
  await db.exec('set role authenticated');const as=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[u(n)]);
  for(let i=1;i<=3;i++){await as(i);await db.query('insert into public.arkid_public_profiles(user_id,display_name,is_public) values($1,$2,$3)',[u(i),'Player '+i,i!==3]);}
  await as(1);await assert.rejects(db.query("insert into public.arkid_rank_events(user_id,source,source_event_id,points) values($1,'verified_2048','fraud',9999)",[u(1)]),/permission denied/);
  await assert.rejects(db.query('select * from public.arkid_rank_events'),/permission denied/);
  await assert.rejects(db.query("select * from public.arkid_monthly_leaderboard('2025-01-02')"),/invalid_period/);
  await db.exec('reset role');
  // Deliberately insert test fixtures as a privileged role, NOT as evidence of a verifier.
  for(const [i,event,points,at] of [[1,'a',30,'2025-02-28 23:59:00+00'],[1,'b',20,'2025-03-01 00:00:00+00'],[2,'c',20,'2025-03-01 00:01:00+00'],[3,'d',999,'2025-03-01 00:00:00+00']])
    await db.query("insert into public.arkid_rank_events(user_id,source,source_event_id,points,occurred_at) values($1,'verified_2048',$2,$3,$4)",[u(i),event,points,at]);
  await assert.rejects(db.query("insert into public.arkid_rank_events(user_id,source,source_event_id,points) values($1,'verified_2048','a',1)",[u(1)]),/unique/);
  await db.exec('set role authenticated');await as(4);
  const march=(await db.query("select * from public.arkid_monthly_leaderboard('2025-03-01')")).rows;
  assert.deepEqual(march.map(x=>[Number(x.place),x.display_name,Number(x.points)]),[[1,'Player 1',20],[2,'Player 2',20]]);
  const feb=(await db.query("select * from public.arkid_monthly_leaderboard('2025-02-01')")).rows;assert.equal(Number(feb[0].points),30);
  await as(1);await db.query('update public.arkid_public_profiles set is_public=false where user_id=$1',[u(1)]);
  await as(4);assert.deepEqual((await db.query("select * from public.arkid_monthly_leaderboard('2025-03-01')")).rows.map(r=>r.display_name),['Player 2']);
  assert.equal((await db.query('select * from public.arkid_monthly_leaderboard()')).rows.length,0);
  for(let i=0;i<26;i++) await db.query("select * from public.arkid_monthly_leaderboard('2025-03-01')");
  await assert.rejects(db.query("select * from public.arkid_monthly_leaderboard('2025-03-01')"),/rank_rate_limited/);
  await db.exec('reset role');await db.query('delete from auth.users where id=$1',[u(1)]);
  assert.equal((await db.query("select count(*)::int n from public.arkid_rank_events where user_id is null")).rows[0].n,2);
  await db.exec('set role anon');await assert.rejects(db.query("select * from public.arkid_monthly_leaderboard('2025-03-01')"),/permission denied/);
 }finally{await db.close()}
});
