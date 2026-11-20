// Trusted ranked API prototype, OFF unless RANKED_ENABLED is explicitly true.
// The verifier secret must only exist in server-side runtime secrets. These
// endpoints do not prevent bots/collusion and must not be used for prizes.
import {validateRankedAttempt} from './ranked-verification.js';
const RANK_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY=24*1024;
class RequestError extends Error {constructor(code,status){super(code);this.status=status}}
async function bodyJSON(request){
  const declared=request.headers.get('content-length');
  if(declared && (!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))throw new RequestError('invalid_request',400);
  if(!request.body)throw new RequestError('invalid_request',400);
  const reader=request.body.getReader();const parts=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw new RequestError('invalid_request',400)}parts.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}
  try{const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value}catch{throw new RequestError('invalid_request',400)}
}
async function rpc(env,name,args){
  let res;
  try{res=await fetch(`${env.SUPABASE_URL.replace(/\/+$/,'')}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:env.RANKED_SERVICE_KEY,Authorization:`Bearer ${env.RANKED_SERVICE_KEY}`,'content-type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)})}catch{throw new RequestError('service_unavailable',503)}
  if(!res.ok){
    let data;try{data=await res.json()}catch{}
    for(const [code,status] of [['rank_daily_limit',429],['rank_attempt_limit',429],['session_expired',409],['session_unavailable',404]])if(data?.message===code)throw new RequestError(code,status);
    throw new RequestError('service_unavailable',503);
  }
  try{return await res.json()}catch{throw new RequestError('service_unavailable',503)}
}
function publicSession(s){
  if(!s||!RANK_UUID.test(s.id||'')||s.rulesVersion!=='2048-v1'||!['open','completed'].includes(s.status)||s.seed===null||!Number.isInteger(Number(s.seed))||Number(s.seed)<0||Number(s.seed)>0xffffffff||!Number.isSafeInteger(Number(s.expiresAt))||(s.status==='completed'&&(!Number.isInteger(s.points)||s.points<1||s.points>1000000)))throw new RequestError('service_unavailable',503);
  return {id:s.id,seed:Number(s.seed),rulesVersion:s.rulesVersion,status:s.status,expiresAt:Number(s.expiresAt),points:s.points};
}
export async function rankedRequest(request,env,userId){
  try{
    if(env.RANKED_ENABLED!=='true'||!env.RANKED_SERVICE_KEY||!env.SUPABASE_URL)return {status:503,data:{error:'ranked_unavailable'}};
    if(typeof userId!=='string'||!RANK_UUID.test(userId))throw new RequestError('unauthorized',401);
    const body=await bodyJSON(request),path=new URL(request.url).pathname;
    if(path==='/v1/ranked/start'){
      if(Object.keys(body).length!==1||typeof body.requestId!=='string'||!RANK_UUID.test(body.requestId))throw new RequestError('invalid_request',400);
      const seed=crypto.getRandomValues(new Uint32Array(1))[0];
      const result=await rpc(env,'arkid_rank_start',{player:userId,request_id:body.requestId,random_seed:seed});
      if(result?.userId!==userId)throw new RequestError('service_unavailable',503);
      return {status:200,data:{session:publicSession(result)}};
    }
    if(path==='/v1/ranked/submit'){
      if(Object.keys(body).length!==2||typeof body.sessionId!=='string'||!RANK_UUID.test(body.sessionId)||!Array.isArray(body.moves)||body.moves.length>4096||body.moves.some(x=>!['L','R','U','D'].includes(x)))throw new RequestError('invalid_request',400);
      const session=await rpc(env,'arkid_rank_begin_verify',{player:userId,session_id:body.sessionId});
      if(session?.id!==body.sessionId||session?.userId!==userId)throw new RequestError('service_unavailable',503);
      if(session.status==='completed')return {status:200,data:{session:publicSession(session)}};
      let verified;
      try{verified=validateRankedAttempt({session:{...session,seed:Number(session.seed),issuedAt:Number(session.issuedAt),expiresAt:Number(session.expiresAt)},userId,moves:body.moves,now:Date.now()})}
      catch{throw new RequestError('invalid_game',400)}
      const result=await rpc(env,'arkid_rank_commit',{player:userId,session_id:session.id,verified_points:verified.points,verified_transcript:body.moves.join('')});
      if(result?.userId!==userId||result?.id!==session.id||result?.status!=='completed')throw new RequestError('service_unavailable',503);
      return {status:200,data:{session:publicSession(result)}};
    }
    throw new RequestError('not_found',404);
  }catch(error){return {status:error instanceof RequestError?error.status:503,data:{error:error instanceof RequestError?error.message:'service_unavailable'}}}
}
