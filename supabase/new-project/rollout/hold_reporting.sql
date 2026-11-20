-- Optional first-stage hold: append this to the SAME transaction that installs
-- social migrations when the reviewer and retention procedure are not ready.
-- This blocks ordinary client RPC calls even if a caller bypasses the UI.
-- It does not delete reports, accounts, teams, or any other data. Blocks and
-- the restricted moderator queue remain available. Do not publish a UI that
-- promises working reporting while this hold is active.
revoke execute on function public.arkid_report_profile(uuid,text),
  public.arkid_report_team(uuid,uuid,text) from public, anon, authenticated;
