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
for(const role of ['anon','authenticated','service_role']){
  if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await admin.query(`create role ${role}`);
}
await admin.end();
const cfg={...config,database:dbname}, db=new Client(cfg);await db.connect();
const clients=[];
try{
 await db.query(`create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for(const f of ['003_public_profiles.sql','004_teams_and_discovery.sql','005_announcements.sql','006_monthly_ranking.sql','007_social_safety.sql','008_ranked_sessions.sql','009_moderation.sql','010_my_monthly_points.sql'])await db.query(await readFile(new URL('../../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
 const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
 for(let n=1;n<=80;n++)await db.query('insert into auth.users(id) values($1)',[id(n)]);
 for(let n=1;n<=80;n++)await db.query('insert into public.arkid_public_profiles(user_id,display_name,is_public) values($1,$2,true)',[id(n),'Player '+n]);
 async function team(t,owner,members=[]){
   await db.query('insert into public.arkid_teams(id,name,owner_id,created_by) values($1,$2,$3,$3)',[id(t),'Team '+t,id(owner)]);
   for(const n of [owner,...members])await db.query('insert into public.arkid_team_members(team_id,user_id) values($1,$2)',[id(t),id(n)]);
 }
 async function invite(i,t,sender,recipient){await db.query('insert into public.arkid_team_invites(id,team_id,sender_id,recipient_id) values($1,$2,$3,$4)',[id(i),id(t),id(sender),id(recipient)])}
 async function as(n){const c=new Client(cfg);await c.connect();clients.push(c);await c.query('set role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);return c}
 async function service(){const c=new Client(cfg);await c.connect();clients.push(c);await c.query('set role service_role');return c}
 async function idempotentRace(first,sql1,args1,second,sql2,args2){
   await first.query('begin');const initial=(await first.query(sql1,args1)).rows[0].result;
   let settled=false;const waiting=second.query(sql2,args2).then(result=>{settled=true;return result.rows[0].result});
   await new Promise(resolve=>setTimeout(resolve,200));assert.equal(settled,false,'second operation must wait');
   await first.query('commit');return [initial,await waiting];
 }
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
 // A block committed while an invite is in flight must prevent its insertion.
 await team(108,31);a=await as(32);b=await as(31);
 await blockedRace(a,'select public.arkid_set_player_block($1,true)',[id(31)],b,'select public.arkid_invite_player($1,$2)',[id(108),id(32)],/player_unavailable/);
 assert.equal((await db.query('select count(*)::int n from public.arkid_team_invites where team_id=$1',[id(108)])).rows[0].n,0);
 // A pre-existing invite cannot be accepted after a racing block commits.
 await team(109,33);await invite(207,109,33,34);a=await as(34);b=await as(34);
 await blockedRace(a,'select public.arkid_set_player_block($1,true)',[id(33)],b,'select public.arkid_respond_team_invite($1,true)',[id(207)],/player_unavailable/);
 assert.equal((await db.query('select count(*)::int n from public.arkid_team_members where user_id=$1 and left_at is null',[id(34)])).rows[0].n,0);
 assert.equal((await db.query('select status from public.arkid_team_invites where id=$1',[id(207)])).rows[0].status,'pending');
 // Concurrent starts share one open challenge; concurrent commits write one event.
 a=await service();b=await service();
 const [firstStart,secondStart]=await idempotentRace(a,'select public.arkid_rank_start($1,$2,9) result',[id(41),id(301)],b,'select public.arkid_rank_start($1,$2,11) result',[id(41),id(302)]);
 assert.equal(firstStart.id,secondStart.id);assert.equal(Number(secondStart.seed),9);
 await a.query('select public.arkid_rank_begin_verify($1,$2)',[id(41),firstStart.id]);
 const [firstCommit,secondCommit]=await idempotentRace(a,'select public.arkid_rank_commit($1,$2,100,$3) result',[id(41),firstStart.id,'LR'],b,'select public.arkid_rank_commit($1,$2,999,$3) result',[id(41),firstStart.id,'UD']);
 assert.equal(firstCommit.points,100);assert.equal(secondCommit.points,100);
 assert.equal((await db.query('select count(*)::int n from public.arkid_rank_events where user_id=$1',[id(41)])).rows[0].n,1);
 // A start waiting on a lock must use post-wait time when checking expiry.
 const oldSession=(await a.query('select public.arkid_rank_start($1,$2,9) result',[id(45),id(303)])).rows[0].result;
 await db.query("update public.arkid_rank_sessions set expires_at=clock_timestamp()+interval '400 milliseconds' where id=$1",[oldSession.id]);
 await a.query('begin');await a.query("select pg_advisory_xact_lock(hashtextextended('rank-session:'||$1::text,0))",[id(45)]);
 let settled=false;const late=b.query('select public.arkid_rank_start($1,$2,10) result',[id(45),id(304)]).then(r=>{settled=true;return r.rows[0].result});
 await new Promise(resolve=>setTimeout(resolve,700));assert.equal(settled,false);await a.query('commit');assert.notEqual((await late).id,oldSession.id);
 // Competing reviewers cannot process the same report twice.
 await db.query('insert into public.arkid_moderators(user_id) values($1)',[id(42)]);
 const report=(await db.query("insert into public.arkid_social_reports(reporter_id,subject_id,reason,display_name_snapshot,bio_snapshot) values($1,$2,'spam','Player','Bio') returning id",[id(43),id(44)])).rows[0].id;
 a=await as(42);b=await as(42);
 await blockedRace(a,"select public.arkid_moderation_resolve('profile',$1,'reviewed')",[report],b,"select public.arkid_moderation_resolve('profile',$1,'dismissed')",[report],/report_unavailable/);
 assert.equal((await db.query('select count(*)::int n from public.arkid_moderation_actions where report_id=$1',[report])).rows[0].n,1);
 console.log('PostgreSQL 17 multi-connection lock tests: ten races passed');
}finally{for(const c of clients)await c.end();await db.end()}
