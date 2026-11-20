import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {replayRanked2048} from '../src/ranked-2048.js';
const user='00000000-0000-0000-0000-000000000001',sessionId='00000000-0000-0000-0000-000000000010',requestId='00000000-0000-0000-0000-000000000011';
const env={ALLOWED_ORIGINS:'https://site.example',SUPABASE_URL:'https://db.example',SUPABASE_PUBLISHABLE_KEY:'public',RANKED_ENABLED:'true',RANKED_SERVICE_KEY:'test-private-server-value'};
const call=(path,body,token='good',origin='https://site.example')=>worker.fetch(new Request('https://worker.example'+path,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}),env);
function movesForGame(){const dirs=['L','U','R','D'],moves=[];let state=replayRanked2048(9,moves);for(let i=0;i<700&&!state.finished;i++)for(let j=0;j<4;j++){const d=dirs[(i+j)%4];try{state=replayRanked2048(9,[...moves,d]);moves.push(d);break}catch(e){if(e.message!=='invalid_move')throw e}}assert.equal(state.finished,true);return moves}

test('ranked API verifies authenticated owner, replays moves, writes once and fails closed',async()=>{
 const old=globalThis.fetch,now=Date.now(),calls=[];let committed=null;
 const session={id:sessionId,userId:user,seed:9,rulesVersion:'2048-v1',status:'open',issuedAt:now-1000,expiresAt:now+100000,points:null};
 try{
  globalThis.fetch=async (url,options)=>{
   if(url.endsWith('/auth/v1/user'))return options.headers.Authorization==='Bearer good'?Response.json({id:user}):new Response('',{status:401});
   assert.equal(options.headers.apikey,env.RANKED_SERVICE_KEY);assert.equal(options.headers.Authorization,'Bearer '+env.RANKED_SERVICE_KEY);
   const fn=url.split('/').pop(),args=JSON.parse(options.body);calls.push({fn,args});assert.equal(args.player,user);
   if(fn==='arkid_rank_start')return Response.json(session);
   if(fn==='arkid_rank_begin_verify')return Response.json(committed||session);
   if(fn==='arkid_rank_commit'){assert.equal(args.verified_points,1288);assert.equal(args.verified_transcript,movesForGame().join(''));committed={...session,status:'completed',points:args.verified_points};return Response.json(committed)}
   throw Error('unexpected request');
  };
  assert.equal((await worker.fetch(new Request('https://worker.example/v1/ranked/start',{method:'POST'}),{...env,RANKED_ENABLED:'false'})).status,503);
  assert.equal((await call('/v1/ranked/start',{requestId},'bad')).status,401);
  assert.equal((await call('/v1/ranked/start',{requestId},'good','https://evil.example')).status,403);
  const start=await call('/v1/ranked/start',{requestId});assert.equal(start.status,200);const started=await start.json();assert.equal(started.session.seed,9);assert.equal(JSON.stringify(started).includes(env.RANKED_SERVICE_KEY),false);
  assert.equal((await call('/v1/ranked/submit',{sessionId,moves:[],points:999999})).status,400);
  assert.equal((await call('/v1/ranked/submit',{sessionId,moves:['wat']})).status,400);
  assert.equal((await call('/v1/ranked/submit',{sessionId,moves:[]})).status,400);
  assert.equal(calls.filter(x=>x.fn==='arkid_rank_commit').length,0);
  const done=await call('/v1/ranked/submit',{sessionId,moves:movesForGame()});assert.equal(done.status,200);assert.equal((await done.json()).session.points,1288);
  const again=await call('/v1/ranked/submit',{sessionId,moves:[]});assert.equal((await again.json()).session.points,1288);assert.equal(calls.filter(x=>x.fn==='arkid_rank_commit').length,1);
  assert.equal((await call('/v1/ranked/start',{requestId:'x'.repeat(25000)})).status,400);
 }finally{globalThis.fetch=old}
});

test('ranked API never exposes privileged backend errors or accepts other accounts sessions',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async (url)=>url.endsWith('/auth/v1/user')?Response.json({id:user}):Response.json({message:'private error details'}, {status:500});
  const res=await call('/v1/ranked/start',{requestId});assert.equal(res.status,503);assert.deepEqual(await res.json(),{error:'service_unavailable'});
  globalThis.fetch=async url=>url.endsWith('/auth/v1/user')?Response.json({id:user}):Response.json({id:sessionId,userId:'00000000-0000-0000-0000-000000000002',status:'completed'});
  assert.equal((await call('/v1/ranked/submit',{sessionId,moves:[]})).status,503);
 }finally{globalThis.fetch=old}
});
