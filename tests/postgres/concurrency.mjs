// Optional integration test: ONLY an isolated PostgreSQL cluster created under
// /tmp/arkid-pg-test with its private socket in /tmp/arkid-pg-socket. Never
// use this script against a real project. No production credentials involved.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
const {Client}=createRequire(import.meta.url)('pg');
if(process.env.ARKID_DISPOSABLE_PG!=='yes')throw Error('Requires ARKID_DISPOSABLE_PG=yes and an isolated local cluster');
const config={host:'/tmp/arkid-pg-socket',port:55439,user:process.env.USER,database:'postgres'};
const admin=new Client(config);await admin.connect();
const dataDirectory=(await admin.query('show data_directory')).rows[0].data_directory;
const listen=(await admin.query('show listen_addresses')).rows[0].listen_addresses;
assert.equal(dataDirectory,'/tmp/arkid-pg-test');assert.equal(listen,'');
const dbname='arkid_test_'+randomBytes(6).toString('hex');
await admin.query(`create database ${dbname}`);
for(const role of ['anon','authenticated']){
  if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await admin.query(`create role ${role}`);
}
await admin.end();
const cfg={...config,database:dbname}, db=new Client(cfg);await db.connect();
const clients=[];
try{
 await db.query(`create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for(const f of ['003_public_profiles.sql','004_teams_and_discovery.sql','005_announcements.sql','006_monthly_ranking.sql'])await db.query(await readFile(new URL('../../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
 const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
 for(let n=1;n<=80;n++)await db.query('insert into auth.users(id) values($1)',[id(n)]);
 for(let n=1;n<=80;n++)await db.query('insert into public.arkid_public_profiles(user_id,display_name,is_public) values($1,$2,true)',[id(n),'Player '+n]);
 async function team(t,owner,members=[]){
   await db.query('insert into public.arkid_teams(id,name,owner_id,created_by) values($1,$2,$3,$3)',[id(t),'Team '+t,id(owner)]);
   for(const n of [owner,...members])await db.query('insert into public.arkid_team_members(team_id,user_id) values($1,$2)',[id(t),id(n)]);
 }
 async function invite(i,t,sender,recipient){await db.query('insert into public.arkid_team_invites(id,team_id,sender_id,recipient_id) values($1,$2,$3,$4)',[id(i),id(t),id(sender),id(recipient)])}
 async function as(n){const c=new Client(cfg);await c.connect();clients.push(c);await c.query('set role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);return c}
 async function blockedRace(first,firstSql,firstArgs,second,secondSql,secondArgs,error){
   await first.query('begin');await first.query(firstSql,firstArgs);
   let settled=false;const waiting=second.query(secondSql,secondArgs).then(x=>({x}),e=>({e})).then(x=>{settled=true;return x});
   await new Promise(resolve=>setTimeout(resolve,200));
   assert.equal(settled,false,'second transaction must wait for first lock');
   await first.query('commit');const result=await waiting;
   assert.ok(result.e,`expected ${error} but operation succeeded`);assert.match(result.e.message,error);
 }
 // Two teams racing to accept the same user cannot give them two memberships.
 await team(101,1);await team(102,2);await invite(201,101,1,3);await invite(202,102,2,3);
 let a=await as(3),b=await as(3);
 await blockedRace(a,'select public.arkid_respond_team_invite($1,true)',[id(201)],b,'select public.arkid_respond_team_invite($1,true)',[id(202)],/already_in_team/);
 assert.equal((await db.query('select count(*)::int n from public.arkid_team_members where user_id=$1 and left_at is null',[id(3)])).rows[0].n,1);
 // Two simultaneous acceptance attempts for the final slot never exceed 20.
 await team(103,4,Array.from({length:18},(_,i)=>i+5));await invite(203,103,4,23);await invite(204,103,4,24);
 a=await as(23);b=await as(24);
 await blockedRace(a,'select public.arkid_respond_team_invite($1,true)',[id(203)],b,'select public.arkid_respond_team_invite($1,true)',[id(204)],/team_full/);
 assert.equal((await db.query('select count(*)::int n from public.arkid_team_members where team_id=$1 and left_at is null',[id(103)])).rows[0].n,20);
 // Competing senders cannot bypass the recipient's three pending invites cap.
 await team(104,25);await team(105,26);await team(106,27);await team(107,28);
 await invite(205,104,25,29);await invite(206,105,26,29);
 a=await as(27);b=await as(28);
 await blockedRace(a,'select public.arkid_invite_player($1,$2)',[id(106),id(29)],b,'select public.arkid_invite_player($1,$2)',[id(107),id(29)],/player_unavailable/);
 assert.equal((await db.query("select count(*)::int n from public.arkid_team_invites where recipient_id=$1 and status='pending'",[id(29)])).rows[0].n,3);
 // Concurrent creation by one player is serialized.
 a=await as(30);b=await as(30);
 await blockedRace(a,'select public.arkid_create_team($1)',['One'],b,'select public.arkid_create_team($1)',['Two'],/already_in_team/);
 assert.equal((await db.query('select count(*)::int n from public.arkid_team_members where user_id=$1 and left_at is null',[id(30)])).rows[0].n,1);
 console.log('PostgreSQL 17 multi-connection lock tests: all four races passed');
}finally{for(const c of clients)await c.end();await db.end()}
