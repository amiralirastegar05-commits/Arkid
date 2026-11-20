import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
test('only explicitly provisioned reviewers can view and resolve reports, with audit and no automatic punishment',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for(const f of ['003_public_profiles.sql','004_teams_and_discovery.sql','007_social_safety.sql','009_moderation.sql'])await db.exec(await readFile(new URL('../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
  for(let i=1;i<=4;i++)await db.query('insert into auth.users values($1,$2::jsonb)',[id(i),'{}']);
  await db.exec('set role authenticated');const as=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);
  for(let i=1;i<=2;i++){await as(i);await db.query('insert into public.arkid_public_profiles(user_id,display_name,bio,is_public) values($1,$2,$3,true)',[id(i),'Player '+i,'Public text']);}
  await as(1);await db.query('select public.arkid_report_profile($1,$2)',[id(2),'spam']);
  const team=(await db.query('select public.arkid_create_team($1) team',['Team Name'])).rows[0].team;
  await db.query('select public.arkid_report_team($1,null,$2)',[team,'other']);
  await as(3);assert.equal((await db.query('select public.arkid_is_moderator() result')).rows[0].result,false);
  await assert.rejects(db.query('select * from public.arkid_moderation_queue()'),/not_moderator/);
  await assert.rejects(db.query('select public.arkid_moderation_resolve($1,$2,$3)',['profile',id(9),'reviewed']),/not_moderator/);
  await assert.rejects(db.query('insert into public.arkid_moderators(user_id) values($1)',[id(3)]),/permission denied/);
  await assert.rejects(db.query('select * from public.arkid_moderation_actions'),/permission denied/);
  await db.exec('reset role');await db.query('insert into public.arkid_moderators(user_id) values($1)',[id(4)]);await db.exec('set role authenticated');await as(4);
  assert.equal((await db.query('select public.arkid_is_moderator() result')).rows[0].result,true);
  const queue=(await db.query('select * from public.arkid_moderation_queue()')).rows;assert.equal(queue.length,2);
  assert.equal('reporter_id' in queue[0],false);const profile=queue.find(r=>r.kind==='profile'),teamReport=queue.find(r=>r.kind==='team');
  assert.equal(profile.name_snapshot,'Player 2');assert.equal(teamReport.name_snapshot,'Team Name');
  await assert.rejects(db.query('select public.arkid_moderation_resolve($1,$2,$3)',['profile',profile.report_id,'delete']),/invalid_review/);
  assert.equal((await db.query('select public.arkid_moderation_resolve($1,$2,$3) result',['profile',profile.report_id,'reviewed'])).rows[0].result,'reviewed');
  await assert.rejects(db.query('select public.arkid_moderation_resolve($1,$2,$3)',['profile',profile.report_id,'dismissed']),/report_unavailable/);
  await db.query('select public.arkid_moderation_resolve($1,$2,$3)',['team',teamReport.report_id,'dismissed']);assert.equal((await db.query('select * from public.arkid_moderation_queue()')).rows.length,0);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.arkid_moderation_actions')).rows[0].n,2);
  assert.equal((await db.query('select is_public from public.arkid_public_profiles where user_id=$1',[id(2)])).rows[0].is_public,true);
  assert.equal((await db.query('select name from public.arkid_teams where id=$1',[team])).rows[0].name,'Team Name');
  await db.query('delete from auth.users where id=$1',[id(4)]);assert.equal((await db.query('select count(*)::int n from public.arkid_moderation_actions where actor_id is null')).rows[0].n,2);
  await db.exec('set role anon');await assert.rejects(db.query('select * from public.arkid_moderation_queue()'),/permission denied/);
 }finally{await db.close()}
});
