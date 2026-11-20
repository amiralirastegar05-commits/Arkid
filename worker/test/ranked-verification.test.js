import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replayRanked2048} from '../src/ranked-2048.js';
import {validateRankedAttempt} from '../src/ranked-verification.js';
const user='00000000-0000-0000-0000-000000000001';
const session={id:'00000000-0000-0000-0000-000000000010',userId:user,seed:9,rulesVersion:'2048-v1',status:'open',issuedAt:1000,expiresAt:3601000};
function completed(){
 const dirs=['L','U','R','D'],moves=[];let state=replayRanked2048(9,moves);
 for(let i=0;i<700&&!state.finished;i++)for(let j=0;j<4;j++){
  const d=dirs[(i+j)%4];try{state=replayRanked2048(9,[...moves,d]);moves.push(d);break}catch(e){if(e.message!=='invalid_move')throw e}
 }
 assert.equal(state.finished,true);return moves;
}
test('validation computes points from server challenge and completed replay, ignoring claimed score',()=>{
 const moves=completed();
 assert.deepEqual(validateRankedAttempt({session,userId:user,moves,now:1001,points:999999}),{sessionId:session.id,userId:user,points:1288,moveCount:132});
 assert.throws(()=>validateRankedAttempt({session,userId:user,moves:[],now:1001}),/game_not_finished/);
 assert.throws(()=>validateRankedAttempt({session,userId:user,moves:[...moves,'L'],now:1001}),/game_already_over/);
 assert.throws(()=>validateRankedAttempt({session,userId:user,moves:['wat'],now:1001}),/invalid_transcript/);
});
test('validation rejects wrong accounts, stale sessions, untrusted clock or rules',()=>{
 const moves=completed(),input={session,userId:user,moves,now:1001};
 assert.throws(()=>validateRankedAttempt({...input,userId:'00000000-0000-0000-0000-000000000002'}),/session_unavailable/);
 assert.throws(()=>validateRankedAttempt({...input,session:{...session,status:'consumed'}}),/session_unavailable/);
 assert.throws(()=>validateRankedAttempt({...input,session:{...session,rulesVersion:'future'}}),/session_unavailable/);
 assert.throws(()=>validateRankedAttempt({...input,now:session.expiresAt}),/session_expired/);
 assert.throws(()=>validateRankedAttempt({...input,now:999}),/session_expired/);
 assert.throws(()=>validateRankedAttempt({...input,now:NaN}),/session_expired/);
 assert.throws(()=>validateRankedAttempt({...input,session:{...session,expiresAt:3601001}}),/session_expired/);
 assert.throws(()=>validateRankedAttempt({...input,session:{...session,id:'not-a-uuid'}}),/invalid_session/);
 assert.throws(()=>validateRankedAttempt({...input,session:{...session,seed:-1}}),/invalid_seed/);
});
