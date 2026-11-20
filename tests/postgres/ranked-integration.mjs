// Fully local Worker-to-real-PostgreSQL integration using a fake Auth/REST
// transport. Never connects to Supabase or real accounts. See tests/README.md.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import worker from '../../worker/src/index.js';
import {createRankedGame} from '../../worker/src/ranked-2048.js';
const {Client}=createRequire(import.meta.url)('pg');
if(process.env.ARKID_DISPOSABLE_PG!=='yes')throw Error('Requires disposable local cluster');
const cfg={host:'/tmp/arkid-pg-socket',port:55439,user:process.env.USER,database:'postgres'};
const admin=new Client(cfg);await admin.connect();
assert.equal((await admin.query('show data_directory')).rows[0].data_directory,'/tmp/arkid-pg-test');assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses,'');
const name='arkid_test_'+randomBytes(6).toString('hex');await admin.query(`create database ${name}`);
for(const role of ['anon','authenticated','service_role'])if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await admin.query(`create role ${role}`);
await admin.end();
const db=new Client({...cfg,database:name});await db.connect();let server;
const oldFetch=globalThis.fetch,user='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
const env={SUPABASE_URL:'https://db.example',SUPABASE_PUBLISHABLE_KEY:'public',ALLOWED_ORIGINS:'https://site.example',RANKED_ENABLED:'true',RANKED_SERVICE_KEY:'test-server-only'};
const call=(path,body,token='one')=>worker.fetch(new Request('https://worker.example'+path,{method:'POST',headers:{Origin:'https://site.example',Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}),env);
try{
 await db.query(`create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const f of ['003_public_profiles.sql','006_monthly_ranking.sql','008_ranked_sessions.sql','010_my_monthly_points.sql'])await db.query(await readFile(new URL('../../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
 await db.query('insert into auth.users(id) values($1),($2)',[user,other]);await db.query("insert into public.arkid_public_profiles(user_id,display_name,is_public) values($1,'Player',true)",[user]);
 server=new Client({...cfg,database:name});await server.connect();await server.query('set role service_role');
 globalThis.fetch=async (url,options)=>{
  if(url.endsWith('/auth/v1/user')){const auth=options.headers.Authorization;return auth==='Bearer one'?Response.json({id:user}):auth==='Bearer two'?Response.json({id:other}):new Response('',{status:401})}
  assert.equal(options.headers.apikey,env.RANKED_SERVICE_KEY);assert.equal(options.headers.Authorization,'Bearer '+env.RANKED_SERVICE_KEY);
  const body=JSON.parse(options.body),fn=url.split('/').pop();let sql,args;
  if(fn==='arkid_rank_start'){sql='select public.arkid_rank_start($1,$2,$3) result';args=[body.player,body.request_id,body.random_seed]}
  else if(fn==='arkid_rank_begin_verify'){sql='select public.arkid_rank_begin_verify($1,$2) result';args=[body.player,body.session_id]}
  else if(fn==='arkid_rank_commit'){sql='select public.arkid_rank_commit($1,$2,$3,$4) result';args=[body.player,body.session_id,body.verified_points,body.verified_transcript]}
  else throw Error('unexpected RPC');
  try{return Response.json((await server.query(sql,args)).rows[0].result)}catch(error){return Response.json({message:error.message},{status:400})}
 };
 const requestId=crypto.randomUUID(),start=await call('/v1/ranked/start',{requestId});assert.equal(start.status,200);const s=(await start.json()).session;
 const retry=(await (await call('/v1/ranked/start',{requestId})).json()).session;assert.equal(retry.id,s.id);assert.equal(retry.seed,s.seed);
 assert.equal((await call('/v1/ranked/submit',{sessionId:s.id,moves:[]},'two')).status,404);
 assert.equal((await call('/v1/ranked/submit',{sessionId:s.id,moves:[]})).status,400);
 const engine=createRankedGame(s.seed),dirs=['L','U','R','D'],moves=[];let state=engine.snapshot();
 for(let i=0;i<4096&&!state.finished;i++)for(let j=0;j<4;j++){const d=dirs[(i+j)%4];try{state=engine.step(d);moves.push(d);break}catch(e){if(e.message!=='invalid_move')throw e}}
 assert.ok(state.finished&&state.score>0,'test game must finish within limit');
 const done=await call('/v1/ranked/submit',{sessionId:s.id,moves});assert.equal(done.status,200);assert.equal((await done.json()).session.points,state.score);
 const repeated=await call('/v1/ranked/submit',{sessionId:s.id,moves});assert.equal((await repeated.json()).session.points,state.score);
 const rows=(await db.query('select points,source_event_id from public.arkid_rank_events where user_id=$1',[user])).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].points,state.score);assert.equal(rows[0].source_event_id,s.id);
 await db.query('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 assert.equal(Number((await db.query('select points from public.arkid_my_monthly_points()')).rows[0].points),state.score);
 const board=(await db.query('select * from public.arkid_monthly_leaderboard()')).rows;assert.equal(Number(board[0].points),state.score);
 console.log(`Full local ranked path: authenticated start, ${moves.length} replayed moves, atomic score, retry and leaderboard passed`);
}finally{globalThis.fetch=oldFetch;if(server)await server.end();await db.end()}
