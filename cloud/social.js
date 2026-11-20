import {currentUser, requireUser} from './public-profile.js';

// Functions check the account both before and after each request. Server-side
// RLS and RPCs remain the authority; the browser cannot decide ownership.
export async function socialCall(client, user, fn, args = {}) {
  if (!['arkid_my_team','arkid_team_inbox','arkid_search_players','arkid_create_team','arkid_invite_player','arkid_respond_team_invite','arkid_leave_team','arkid_transfer_team_owner','arkid_claim_team_owner','arkid_announcement_feed','arkid_read_announcement','arkid_monthly_leaderboard'].includes(fn)) throw Error('invalid_operation');
  await requireUser(client,user);
  const {data,error} = await client.rpc(fn,args);
  if (error) throw error;
  await requireUser(client,user);
  return data;
}
export {currentUser};
