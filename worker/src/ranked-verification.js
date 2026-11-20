// Pure validation of a *server-owned* challenge and transcript. This module
// has no endpoint or database privileges and NEVER writes ranking points.
// It does not issue sessions, enforce one-time use atomically, prevent bots,
// or replace a trusted Worker/backend and server-side transaction.
import {replayRanked2048} from './ranked-2048.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LIFETIME_MS=60*60*1000;
const MAX_POINTS=1_000_000; // ledger constraint, not a final competition rule

// session and now MUST come from trusted server storage/clock, not the client.
// userId MUST come from verified authentication, not request JSON.
// Only moves may be provided by the player; any claimed score is ignored.
export function validateRankedAttempt({session,userId,moves,now}){
  if(!session||typeof session!=='object'||!UUID.test(session.id||'')||!UUID.test(session.userId||''))throw Error('invalid_session');
  if(!UUID.test(userId||'')||session.userId!==userId)throw Error('session_unavailable');
  if(session.rulesVersion!=='2048-v1'||session.status!=='open')throw Error('session_unavailable');
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(session.issuedAt)||!Number.isSafeInteger(session.expiresAt)||
     session.expiresAt<=session.issuedAt||session.expiresAt-session.issuedAt>MAX_LIFETIME_MS||
     now<session.issuedAt||now>=session.expiresAt)throw Error('session_expired');
  const result=replayRanked2048(session.seed,moves);
  if(!result.finished)throw Error('game_not_finished');
  if(result.score<1||result.score>MAX_POINTS)throw Error('score_out_of_range');
  return {sessionId:session.id,userId,points:result.score,moveCount:result.moves};
}
