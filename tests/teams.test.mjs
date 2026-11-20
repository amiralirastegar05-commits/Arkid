import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const u=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
async function setup() {
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for(const file of ['001_profiles.sql','002_snapshots.sql','003_public_profiles.sql','004_teams_and_discovery.sql']) await db.exec(await readFile(new URL('../supabase/new-project/migrations/'+file,import.meta.url),'utf8'));
  for(let i=1;i<=25;i++) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2::jsonb)',[u(i),'{}']);
  await db.exec('set role authenticated');
  return db;
}
async function as(db,n){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u(n)]);}

test('team invitations require authorization and explicit acceptance without deleting data',async()=>{
 const db=await setup();try{
  await as(db,1);
  await db.query('insert into public.arkid_public_profiles(user_id,display_name,is_public) values ($1,$2,true)',[u(1),'Alice']);
  const team=(await db.query('select public.arkid_create_team($1) id',['Dream Team'])).rows[0].id;
  await assert.rejects(db.query('select public.arkid_create_team($1)',['Second Team']),/already_in_team/);
  await assert.rejects(db.query('select public.arkid_invite_player($1,$2)',[team,u(2)]),/player_unavailable/);
  await as(db,2);
  await db.query('insert into public.arkid_public_profiles(user_id,display_name,is_public) values($1,$2,true)',[u(2),'Bob']);
  await assert.rejects(db.query('select public.arkid_invite_player($1,$2)',[team,u(3)]),/not_team_owner/);
  await assert.rejects(db.query('insert into public.arkid_team_members(team_id,user_id) values($1,$2)',[team,u(2)]),/permission denied/);
  await assert.rejects(db.query('select public.arkid_respond_team_invite($1,true)',['00000000-0000-0000-0000-000000000099']),/invite_unavailable/);
  await as(db,1);
  const invite=(await db.query('select public.arkid_invite_player($1,$2) id',[team,u(2)])).rows[0].id;
  await assert.rejects(db.query('select public.arkid_invite_player($1,$2)',[team,u(2)]),/invite_recent/);
  await as(db,3);
  assert.equal((await db.query('select count(*)::int n from public.arkid_team_invites')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from public.arkid_teams')).rows[0].n,0);
  await assert.rejects(db.query('select public.arkid_respond_team_invite($1,true)',[invite]),/invite_unavailable/);
  await as(db,2);
  assert.equal((await db.query('select count(*)::int n from public.arkid_team_members')).rows[0].n,0);
  const inbox=(await db.query('select * from public.arkid_team_inbox()')).rows;
  assert.equal(inbox.length,1); assert.equal(inbox[0].team_name,'Dream Team'); assert.equal(inbox[0].sender_name,'Alice');
  assert.equal((await db.query('select public.arkid_respond_team_invite($1,true) status',[invite])).rows[0].status,'accepted');
  assert.equal((await db.query('select count(*)::int n from public.arkid_team_inbox()')).rows[0].n,0);
  const mine=(await db.query('select * from public.arkid_my_team()')).rows[0];
  assert.equal(mine.team_name,'Dream Team');assert.equal(mine.members.length,2);
  await assert.rejects(db.query('select public.arkid_respond_team_invite($1,true)',[invite]),/invite_unavailable/);
  await assert.rejects(db.query('select public.arkid_create_team($1)',['Other team']),/already_in_team/);
  await assert.rejects(db.query('delete from public.arkid_team_invites'),/permission denied/);
  await as(db,1);assert.equal((await db.query('select status from public.arkid_team_invites where id=$1',[invite])).rows[0].status,'accepted');
  await assert.rejects(db.query('select public.arkid_leave_team()'),/transfer_required/);
  await assert.rejects(db.query('select public.arkid_transfer_team_owner($1)',[u(3)]),/player_unavailable/);
  assert.equal((await db.query('select public.arkid_transfer_team_owner($1) result',[u(2)])).rows[0].result,'transferred');
  assert.equal((await db.query('select public.arkid_leave_team() result')).rows[0].result,'left');
  assert.equal((await db.query('select count(*)::int n from public.arkid_team_members where left_at is not null')).rows[0].n,1);
  await as(db,2);assert.equal((await db.query('select owner_id from public.arkid_my_team()')).rows[0].owner_id,u(2));
  assert.equal((await db.query('select public.arkid_leave_team() result')).rows[0].result,'left');
  await as(db,1);assert.ok((await db.query('select public.arkid_create_team($1) id',['New Team'])).rows[0].id);
  await db.query('select public.arkid_leave_team()');
  await db.query('select public.arkid_create_team($1)',['Third Team']);
  await db.query('select public.arkid_leave_team()');
  await assert.rejects(db.query('select public.arkid_create_team($1)',['Fourth Team']),/team_creation_limited/);
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select * from public.arkid_team_inbox()'),/permission denied/);
  await assert.rejects(db.query('select * from public.arkid_teams'),/permission denied/);
 }finally{await db.close()}
});

test('search excludes hidden profiles, bounds results and limits repeated requests',async()=>{
 const db=await setup();try{
  for(let i=2;i<=25;i++){await as(db,i);await db.query('insert into public.arkid_public_profiles(user_id,display_name,is_public) values($1,$2,$3)',[u(i),'Player '+i,i!==2]);}
  await as(db,1);
  await assert.rejects(db.query('select * from public.arkid_search_players($1)',['P']),/invalid_search/);
  const rows=(await db.query('select * from public.arkid_search_players($1)',['Player'])).rows;
  assert.equal(rows.length,20);assert.equal(rows.some(r=>r.user_id===u(2)),false);
  assert.equal((await db.query('select count(*)::int n from public.arkid_public_profiles')).rows[0].n,0);
  for(let i=0;i<29;i++)await db.query('select * from public.arkid_search_players($1)',['Player']);
  await assert.rejects(db.query('select * from public.arkid_search_players($1)',['Player']),/search_rate_limited/);
  await assert.rejects(db.query('select * from public.arkid_search_rate'),/permission denied/);
 }finally{await db.close()}
});
