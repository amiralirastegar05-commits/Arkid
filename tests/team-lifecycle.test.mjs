import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const u=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
test('a full team cannot be joined and owner deletion preserves the team for its members',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for(const f of ['001_profiles.sql','002_snapshots.sql','003_public_profiles.sql','004_teams_and_discovery.sql'])await db.exec(await readFile(new URL('../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
 for(let n=1;n<=21;n++)await db.query('insert into auth.users values($1,$2::jsonb)',[u(n),'{}']);
 await db.exec('set role authenticated');const as=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[u(n)]);
 await as(21);await db.query('insert into public.arkid_public_profiles(user_id,display_name,is_public) values($1,$2,true)',[u(21),'Twenty One']);
 await as(1);const team=(await db.query('select public.arkid_create_team($1) id',['Full Team'])).rows[0].id;
 await db.exec('reset role');for(let n=2;n<=20;n++)await db.query('insert into public.arkid_team_members(team_id,user_id) values($1,$2)',[team,u(n)]);
 await db.exec('set role authenticated');await as(1);
 await assert.rejects(db.query('select public.arkid_invite_player($1,$2)',[team,u(21)]),/team_full/);
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[u(1)]);
 assert.equal((await db.query('select owner_id from public.arkid_teams where id=$1',[team])).rows[0].owner_id,null);
 assert.equal((await db.query('select count(*)::int n from public.arkid_team_members where team_id=$1 and left_at is null',[team])).rows[0].n,19);
 await db.exec('set role authenticated');await as(2);
 assert.equal((await db.query('select public.arkid_claim_team_owner() result')).rows[0].result,'claimed');
 assert.equal((await db.query('select owner_id from public.arkid_my_team()')).rows[0].owner_id,u(2));
 await as(3);await assert.rejects(db.query('select public.arkid_claim_team_owner()'),/owner_exists/);
 }finally{await db.close()}
});
