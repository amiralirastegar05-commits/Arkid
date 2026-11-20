// Integration against a disposable LOCAL Supabase stack: real GoTrue,
// PostgREST and PostgreSQL, synthetic accounts only. Never contacts production.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import worker from '../../worker/src/index.js';
import {createRankedGame} from '../../worker/src/ranked-2048.js';
const base=process.env.ARKID_LOCAL_API, anon=process.env.ARKID_LOCAL_ANON, service=process.env.ARKID_LOCAL_SERVICE;
if(process.env.ARKID_LOCAL_SUPABASE!=='yes' || base!=='http://127.0.0.1:54321' || !anon || !service)throw Error('Requires explicit disposable localhost Supabase stack');
const headers=token=>({apikey:anon,authorization:`Bearer ${token||anon}`,'content-type':'application/json'});
async function request(path,{method='GET',token,body,prefer}={}){
 const response=await fetch(base+path,{method,headers:{...headers(token),...(prefer?{prefer}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let data;try{data=await response.json()}catch{data=null}
 return {status:response.status,data};
}
async function ok(path,opts){const r=await request(path,opts);assert.ok(r.status>=200&&r.status<300,`${path} returned ${r.status}: ${JSON.stringify(r.data)}`);return r.data}
const rpc=(token,name,args={})=>ok('/rest/v1/rpc/'+name,{method:'POST',token,body:args});
const pw=randomBytes(18).toString('base64url');
async function signup(email){
 const body=await ok('/auth/v1/signup',{method:'POST',body:{email,password:pw}});
 assert.ok(body.access_token&&body.user?.id);return {id:body.user.id,token:body.access_token};
}
const alice=await signup('alice@example.com'),bob=await signup('bob@example.com'),hidden=await signup('hidden@example.com');
for(const [u,name,visible] of [[alice,'Alice',true],[bob,'Bob',true],[hidden,'Hidden',false]]){
 await ok('/rest/v1/arkid_public_profiles',{method:'POST',token:u.token,body:{user_id:u.id,display_name:name,is_public:visible},prefer:'return=minimal'});
}
// Direct reads are own-only; public discovery is explicit opt-in.
assert.deepEqual(await ok(`/rest/v1/arkid_public_profiles?user_id=eq.${alice.id}`,{token:bob.token}),[]);
assert.equal((await rpc(alice.token,'arkid_search_players',{query_text:'Bob'}))[0].user_id,bob.id);
assert.deepEqual(await rpc(alice.token,'arkid_search_players',{query_text:'Hidden'}),[]);
const spoof=await request('/rest/v1/arkid_public_profiles',{method:'POST',token:bob.token,body:{user_id:alice.id,display_name:'Forged'}});
assert.ok(spoof.status>=400);
const team=await rpc(alice.token,'arkid_create_team',{team_name:'Local team'});
const invite=await rpc(alice.token,'arkid_invite_player',{team,target:bob.id});
assert.equal(await rpc(bob.token,'arkid_block_invite_sender',{invite}),'blocked');
const blocked=await request('/rest/v1/rpc/arkid_respond_team_invite',{method:'POST',token:bob.token,body:{invite,accept_invite:true}});
assert.ok(blocked.status>=400);
assert.equal(await rpc(bob.token,'arkid_set_player_block',{target:alice.id,blocked:false}),'unblocked');
await rpc(bob.token,'arkid_respond_team_invite',{invite,accept_invite:true});
await rpc(bob.token,'arkid_report_profile',{target:alice.id,report_reason:'spam'});
assert.ok((await request('/rest/v1/rpc/arkid_moderation_queue',{method:'POST',token:bob.token,body:{}})).status>=400);
// Provision a synthetic reviewer only on the disposable local database.
assert.match(alice.id,/^[0-9a-f-]{36}$/i);
execFileSync('psql',['--set','ON_ERROR_STOP=1','--command',`insert into public.arkid_moderators(user_id) values('${alice.id}')`],{stdio:'ignore',env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGPASSWORD:'postgres',PGDATABASE:'postgres'}});
const reports=await rpc(alice.token,'arkid_moderation_queue');assert.equal(reports.length,1);
assert.equal(await rpc(alice.token,'arkid_moderation_resolve',{kind:'profile',report:reports[0].report_id,outcome:'reviewed'}),'reviewed');
// Check existing cloud snapshots are still isolated through actual PostgREST.
const saved=await rpc(alice.token,'arkid_save_snapshot',{expected_user:alice.id,expected_revision:null,snapshot:{schema:1,storage:{arcade_points:'42'}}});
assert.ok(saved.revision);assert.deepEqual(await ok(`/rest/v1/arkid_cloud_snapshots?user_id=eq.${alice.id}`,{token:bob.token}),[]);
// Exercise actual Worker source with real local Auth and service-role PostgREST.
const env={SUPABASE_URL:base,SUPABASE_PUBLISHABLE_KEY:anon,ALLOWED_ORIGINS:'https://site.example',RANKED_ENABLED:'true',RANKED_SERVICE_KEY:service};
async function workerCall(path,token,body){return worker.fetch(new Request('https://worker.example'+path,{method:'POST',headers:{Origin:'https://site.example',Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)}),env)}
const start=await workerCall('/v1/ranked/start',alice.token,{requestId:randomUUID()});assert.equal(start.status,200);const s=(await start.json()).session;
assert.equal((await workerCall('/v1/ranked/submit',bob.token,{sessionId:s.id,moves:[]})).status,404);
const game=createRankedGame(s.seed),dirs=['L','U','R','D'],moves=[];let state=game.snapshot();
for(let i=0;i<4096&&!state.finished;i++)for(let j=0;j<4;j++){const d=dirs[(i+j)%4];try{state=game.step(d);moves.push(d);break}catch(e){if(e.message!=='invalid_move')throw e}}
assert.ok(state.finished&&state.score>0);const result=await workerCall('/v1/ranked/submit',alice.token,{sessionId:s.id,moves});assert.equal(result.status,200);assert.equal((await result.json()).session.points,state.score);
const repeat=await workerCall('/v1/ranked/submit',alice.token,{sessionId:s.id,moves});assert.equal((await repeat.json()).session.points,state.score);
assert.equal(Number((await rpc(alice.token,'arkid_my_monthly_points',{}))[0].points),state.score);
const board=await rpc(bob.token,'arkid_monthly_leaderboard',{});assert.equal(Number(board.find(r=>r.user_id===alice.id).points),state.score);
console.log('Local Supabase GoTrue + PostgREST + PostgreSQL: three synthetic accounts, privacy, teams, blocks, reports, moderation, snapshot isolation, Worker ranked and leaderboard passed.');
