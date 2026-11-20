import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const f of ['003_public_profiles.sql','004_teams_and_discovery.sql','007_social_safety.sql'])await db.exec(await readFile(new URL('../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
 for(let i=1;i<=15;i++)await db.query('insert into auth.users values($1,$2::jsonb)',[id(i),'{}']);
 await db.exec('set role authenticated');
 const as=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);
 for(let i=1;i<=15;i++){await as(i);await db.query('insert into public.arkid_public_profiles(user_id,display_name,bio,is_public) values($1,$2,$3,$4)',[id(i),'Player '+i,'Bio '+i,i!==15]);}
 return {db,as};
}
test('blocks protect both directions and pending acceptance without removing invitations or members',async()=>{
 const {db,as}=await setup();try{
  await as(1);const team=(await db.query('select public.arkid_create_team($1) team',['First'])).rows[0].team;
  const invite=(await db.query('select public.arkid_invite_player($1,$2) id',[team,id(2)])).rows[0].id;
  await as(3);await assert.rejects(db.query('select public.arkid_block_invite_sender($1)',[invite]),/invite_unavailable/);
  await as(2);assert.equal((await db.query('select public.arkid_block_invite_sender($1) r',[invite])).rows[0].r,'blocked');
  assert.deepEqual((await db.query('select * from public.arkid_my_blocks()')).rows.map(x=>x.user_id),[id(1)]);
  await assert.rejects(db.query('select public.arkid_respond_team_invite($1,true)',[invite]),/player_unavailable/);
  assert.equal((await db.query('select count(*)::int n from public.arkid_team_members where user_id=$1 and left_at is null',[id(2)])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from public.arkid_team_inbox()')).rows[0].n,1);
  await as(1);assert.deepEqual((await db.query('select * from public.arkid_my_blocks()')).rows,[]);
  await as(2);await db.query('select public.arkid_set_player_block($1,false)',[id(1)]);
  assert.equal((await db.query('select public.arkid_respond_team_invite($1,true) result',[invite])).rows[0].result,'accepted');
  await db.query('select public.arkid_set_player_block($1,true)',[id(1)]);
  assert.equal((await db.query('select count(*)::int n from public.arkid_my_team()')).rows[0].n,1);
  await as(4);const team2=(await db.query('select public.arkid_create_team($1) team',['Second'])).rows[0].team;
  await db.query('select public.arkid_set_player_block($1,true)',[id(5)]);
  await assert.rejects(db.query('select public.arkid_invite_player($1,$2)',[team2,id(5)]),/player_unavailable/);
  await as(5);await db.query('select public.arkid_set_player_block($1,true)',[id(4)]);
  await as(4);await db.query('select public.arkid_set_player_block($1,false)',[id(5)]);
  await assert.rejects(db.query('select public.arkid_invite_player($1,$2)',[team2,id(5)]),/player_unavailable/);
  await assert.rejects(db.query('select * from public.arkid_player_blocks'),/permission denied/);
  await assert.rejects(db.query('select public.arkid_lock_player_pair($1,$2)',[id(4),id(5)]),/permission denied/);
  await assert.rejects(db.query('select public.arkid_set_player_block($1,true)',[id(15)]),/player_unavailable/);
  // A private sender may still be blocked from a pending invite, then declined.
  await as(6);const team3=(await db.query('select public.arkid_create_team($1) team',['Third'])).rows[0].team;
  const invite3=(await db.query('select public.arkid_invite_player($1,$2) id',[team3,id(7)])).rows[0].id;
  await db.query('update public.arkid_public_profiles set is_public=false where user_id=$1',[id(6)]);
  await as(7);await db.query('select public.arkid_block_invite_sender($1)',[invite3]);
  assert.equal((await db.query('select * from public.arkid_my_blocks()')).rows[0].display_name,'بازیکن');
  assert.equal((await db.query('select public.arkid_respond_team_invite($1,false) result',[invite3])).rows[0].result,'declined');
  await as(8);for(let n=0;n<30;n++)await db.query('select public.arkid_set_player_block($1,true)',[id(9)]);
  await assert.rejects(db.query('select public.arkid_set_player_block($1,true)',[id(9)]),/block_rate_limited/);
  assert.equal((await db.query('select public.arkid_set_player_block($1,false) r',[id(9)])).rows[0].r,'unblocked');
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.arkid_my_blocks()'),/permission denied/);
 }finally{await db.close()}
});

test('profile reports are private, bounded, preserve submitted public evidence and cannot be forged by direct writes',async()=>{
 const {db,as}=await setup();try{
  await as(1);
  await assert.rejects(db.query('select public.arkid_report_profile($1,$2)',[id(1),'spam']),/invalid_report/);
  await assert.rejects(db.query('select public.arkid_report_profile($1,$2)',[id(2),'arbitrary']),/invalid_report/);
  await assert.rejects(db.query('select public.arkid_report_profile($1,$2)',[id(15),'spam']),/player_unavailable/);
  assert.equal((await db.query('select public.arkid_report_profile($1,$2) result',[id(2),'inappropriate'])).rows[0].result,'reported');
  await assert.rejects(db.query('select public.arkid_report_profile($1,$2)',[id(2),'spam']),/report_recent/);
  await assert.rejects(db.query('select * from public.arkid_social_reports'),/permission denied/);
  await assert.rejects(db.query('insert into public.arkid_social_reports(reporter_id,subject_id,reason,display_name_snapshot,bio_snapshot) values($1,$2,$3,$4,$5)',[id(1),id(2),'spam','a','b']),/permission denied/);
  await as(2);await db.query('update public.arkid_public_profiles set bio=$1,is_public=false where user_id=$2',['changed',id(2)]);
  await as(1);for(let n=3;n<=11;n++)await db.query('select public.arkid_report_profile($1,$2)',[id(n),'spam']);
  await assert.rejects(db.query('select public.arkid_report_profile($1,$2)',[id(12),'spam']),/report_rate_limited/);
  await db.exec('reset role');
  const reports=(await db.query('select * from public.arkid_social_reports where subject_id=$1',[id(2)])).rows;
  assert.equal(reports.length,1);assert.equal(reports[0].bio_snapshot,'Bio 2');assert.equal(reports[0].status,'pending');
  await db.query('delete from auth.users where id=$1',[id(2)]);
  const preserved=(await db.query("select subject_id,bio_snapshot from public.arkid_social_reports where display_name_snapshot='Player 2'")).rows;
  assert.deepEqual(preserved,[{subject_id:null,bio_snapshot:'Bio 2'}]);
 }finally{await db.close()}
});

test('team-name reporting requires membership or a received invite and shares the report limit',async()=>{
 const {db,as}=await setup();try{
  await as(1);const team=(await db.query('select public.arkid_create_team($1) team',['Original name'])).rows[0].team;
  const invite=(await db.query('select public.arkid_invite_player($1,$2) id',[team,id(2)])).rows[0].id;
  await as(3);
  await assert.rejects(db.query('select public.arkid_report_team($1,null,$2)',[team,'spam']),/team_unavailable/);
  await assert.rejects(db.query('select public.arkid_report_team(null,$1,$2)',[invite,'spam']),/team_unavailable/);
  await as(2);
  await assert.rejects(db.query('select public.arkid_report_team($1,$2,$3)',[team,invite,'spam']),/invalid_report/);
  assert.equal((await db.query('select public.arkid_report_team(null,$1,$2) r',[invite,'inappropriate'])).rows[0].r,'reported');
  await assert.rejects(db.query('select public.arkid_report_team(null,$1,$2)',[invite,'spam']),/report_recent/);
  await assert.rejects(db.query('select * from public.arkid_team_reports'),/permission denied/);
  for(let n=3;n<=11;n++)await db.query('select public.arkid_report_profile($1,$2)',[id(n),'spam']);
  await assert.rejects(db.query('select public.arkid_report_profile($1,$2)',[id(12),'spam']),/report_rate_limited/);
  await as(1);assert.equal((await db.query('select public.arkid_report_team($1,null,$2) r',[team,'other'])).rows[0].r,'reported');
  await db.exec('reset role');await db.query('update public.arkid_teams set name=$1 where id=$2',['Changed',team]);
  assert.deepEqual((await db.query('select team_name_snapshot from public.arkid_team_reports order by reporter_id')).rows.map(r=>r.team_name_snapshot),['Original name','Original name']);
 }finally{await db.close()}
});
