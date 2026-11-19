# Arkid next-phase report — 2026-11-19 UTC

This report was prepared after the merge on the session branch `arena/0b5bf391-arkid`; it is not part of merge commit `083117de9121e31a8bee325527892e274cc12bf4` or automatically included in `cloud-integration-phase1`.

## Executive summary and immediate warning

- PR [#1](https://github.com/amiralirastegar05-commits/Arkid/pull/1) was merged **into `cloud-integration-phase1`**, not `main`, at merge commit [`083117de9121e31a8bee325527892e274cc12bf4`](https://github.com/amiralirastegar05-commits/Arkid/commit/083117de9121e31a8bee325527892e274cc12bf4). Head was `fba2c348b0fb783c1659a37a3e13bbb3e07eadcf`.
- **Important: the merge automatically caused a live GitHub Pages deployment.** The repository's Pages source is `cloud-integration-phase1` at `/`; GitHub reports the Pages build/deployment for the merge commit completed successfully. I did not check the Pages publishing configuration before merging, and should have done so given the instruction not to deploy production infrastructure without confirmation. No separate deployment command was run, but the configured automation published the merge. See [Pages deployment run](https://github.com/amiralirastegar05-commits/Arkid/actions/runs/44507634663). `main` was not modified. No production rollback or further infrastructure change was made.
- The connected Supabase project is named `Arkid`, reference **`uirtfghcpzevedvbaekj`**. The merged frontend and Worker configuration instead point to **`kttefkhuchbufobdgdhi`**. Project names are not proof of identity; these are distinct project references. The configured project was not present in the connector's project list and was not audited. **Do not run migrations until the owner confirms the intended project and the correct project is accessible.**
- Migration **005 is not compatible as-is** with the connected project's current schema: `bio` and `avatar_path` are absent, and an existing permissive SELECT policy has a different name and would remain. Migration 004's objects are absent there. No live SQL changes or migrations were executed.
- The public Worker health endpoint responds, but its response differs from the merged Worker source. Worker deployment settings, CORS and real token verification remain unverified. Backup/recovery availability is unverified. This is **not** an authorization to deploy migrations or redeploy the Worker.

## 1. GitHub merge and verification

- Before merge, GitHub reported PR #1 open, draft, `MERGEABLE` / `CLEAN`, base `cloud-integration-phase1` at `4b625d01d9fceeb6367ca25adf43fdea016d9049`, head `arena/0b5bf391-arkid` at `fba2c348b0fb783c1659a37a3e13bbb3e07eadcf`; the working tree was clean. The diff comprised the 19 previously reviewed cloud/auth/Worker/migration, test, documentation and cache files. The PR reported no status checks; this is not a CI success.
- `npm test` passed **19/19** locally; `git diff --check` was clean; `git merge-tree --write-tree` succeeded. These tests include mocked browser storage/Worker calls and PGlite with mocked Auth roles, not live Supabase, actual browser behavior or production load.
- The PR was explicitly marked ready with `gh pr ready 1` and merged using `gh pr merge 1 --merge`. GitHub reports `MERGED` at `2026-11-19T10:39:04Z`. `git ls-remote` showed integration base `083117de9121e31a8bee325527892e274cc12bf4` and `main` `04435f4dc6111d482e11190639d4ecf0d2ec1bb3` after the merge.
- **Automatic Pages deployment:** GitHub Pages API reports `build_type=legacy`, source branch `cloud-integration-phase1`, path `/`, site `https://amiralirastegar05-commits.github.io/Arkid/`. Pages build history lists merge commit `083117de9121e31a8bee325527892e274cc12bf4` as `built`, and its Actions run reports `completed` / `success`. This was an automatic effect of the requested merge; it was not separately confirmed by the user as a production deployment and I should have identified the configuration in advance. Deployed frontend behavior, cache propagation and player impact have not been tested. No Worker or database deployment was initiated.

## 2. Connected Supabase project: read-only findings

The Supabase integration was enabled. `list_projects` returned one accessible project: `Arkid`, ref `uirtfghcpzevedvbaekj`, region `ap-southeast-2`, status `ACTIVE_HEALTHY`, PostgreSQL `17.12.0.000`. `get_project_health` returned healthy database, Auth and REST services. These facts apply **only to the connected project**, not to the repository-configured `kttefkhuchbufobdgdhi` project.

All database queries in this audit were read-only catalog queries or aggregate counts. No user records or credential values were retrieved. Observations are point-in-time, not guarantees against subsequent changes.

### Existing schema

- `public` has one base table, `profiles`; no public game-save tables were listed. The inspected project has **0 Auth users and 0 profile rows**, with 0 Auth users missing profiles, at the time of the aggregate query. This does not describe the separate configured project or browser localStorage.
- `profiles` columns: `id uuid NOT NULL`, `username text NULL`, `display_name text NULL`, `avatar_url text NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`. There is no `bio` or `avatar_path`.
- Constraints: primary key `id`; foreign key `id -> auth.users(id) ON DELETE CASCADE`; case-sensitive unique `username`. Indexes observed are the primary-key and `username` unique indexes. No repository-style case-insensitive username index or bio-length check was observed.
- RLS is enabled on `profiles`; it is not FORCE RLS. Existing policies:
  - `Profiles are viewable by authenticated users`: permissive SELECT, role `authenticated`, `USING (true)`.
  - `Users can update their own profile`: permissive UPDATE, `USING (auth.uid() = id)` and equivalent `WITH CHECK`.
- `anon` and `authenticated` have table-level `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES` and `TRIGGER` grants on `profiles`; column privileges also appear broadly for existing columns. RLS policies additionally govern ordinary row access, so these grants alone do not prove anonymous row access. `TRUNCATE` is not governed by row-level security and needs least-privilege review; do not assume that PostgREST exposes every SQL privilege directly. Other effective memberships and production API behavior have not been exhaustively tested.
- Public functions observed: `handle_new_user()` (security definer, empty search path) and `update_updated_at()` (not security definer, empty search path). `auth.users` has AFTER INSERT trigger `on_auth_user_created` calling `handle_new_user()`. `profiles` has BEFORE UPDATE trigger `profiles_updated_at` calling `update_updated_at()`. The current signup trigger inserts a profile with `display_name` derived from `full_name` then `name` metadata. Trigger functionality was not exercised with a real signup.
- Connector `list_migrations` returned an empty list. This is migration-history evidence, not proof that no SQL was ever applied manually. The existing profile table, trigger and policies demonstrate at least a partially established profile foundation, but do not match repository migrations exactly.
- `to_regclass` / `to_regprocedure` returned null for `public.arkid_cloud_snapshots`, `public.arkid_cloud_snapshot_history` and `public.arkid_save_snapshot(uuid,uuid,jsonb)`. No 004 snapshot objects were observed on this connected project. No `Users can view their own profile` policy was observed; the existing policy names do not show 005 applied. This assessment does not cover the repository-configured project.

## 3. Migration 004 and 005 compatibility and risks

### 004 — cloud snapshots

004 creates current and history tables with JSONB data, UUID revisions, RLS enabled, own-user SELECT policies, restricted grants, and a security-definer `arkid_save_snapshot(expected_user, expected_revision, snapshot)` function. The function checks `auth.uid()`, uses an advisory transaction lock and checks revisions before replacing the current row and archiving the previous one. Local fresh-schema PGlite tests passed.

On the **connected** project the relevant tables/function are absent, and PostgreSQL 17 and `auth.users` exist, so the obvious name/foreign-key prerequisites appear present; this is **not a complete compatibility or security verification**, and it says nothing about the different configured project. Validate role ownership, default grants, PostgREST exposure, extension/function availability, privileges and concurrency in a staging copy first. `CREATE TABLE IF NOT EXISTS` would not retrofit constraints on any pre-existing partial tables, and `CREATE OR REPLACE FUNCTION` could replace an existing function if the target differs.

The migration does not directly delete or overwrite existing profile/game rows. It does define `ON DELETE CASCADE`: a future Auth-user deletion deletes that user's snapshots and history. History grows without a configured retention limit. The RPC enforces top-level shape/size but does not validate every key/value; its textual schema comparison also accepts a JSON string `"1"` that the browser rejects. User-controlled data and replayed local progress are not a server-authoritative transaction ledger. Restoring a previous snapshot can revert progress or duplicate rewards if done manually.

### 005 — profile privacy

005 drops only policies named `Authenticated users can view profiles` and `Users can view their own profile`, creates an own-user SELECT policy, revokes authenticated table-level UPDATE, and grants UPDATE on `username`, `display_name`, `bio`, `avatar_path`.

On the connected project:

1. `bio` and `avatar_path` do not exist. The final `GRANT UPDATE` would fail as written. Whether earlier statements roll back depends on the migration runner and transaction boundary; the connector's migration tool says it rolls back failures, but no execution was attempted. Never rely on a partial manual run.
2. The existing broad SELECT policy is named **`Profiles are viewable by authenticated users`**, not either dropped name. PostgreSQL permissive policies combine with OR, so even if the missing columns were added and 005 succeeded, this policy would still allow authenticated users to select other profiles; the intended privacy change would not be effective.
3. Existing `anon` grants and other privileges are not comprehensively removed by 005. Revoking a table-level grant alone is not proof that all column-level/inherited privileges are gone. `avatar_url` exists, but 005 instead grants on `avatar_path`; existing clients relying on updates to `avatar_url` could break. Review role memberships, explicit grants, policy intent and consumers before any change.
4. 005 itself does not alter Auth triggers or delete profiles, but its effect on profile reads/updates can affect clients. Existing signup/trigger functionality and Auth will not be claimed safe until real staging sign-up, update and read tests pass. Repository migration 003 adds the missing columns, but applying it must be separately reviewed, not assumed safe; 001 may replace the existing signup function/trigger, change policies/grants and attempt a case-insensitive unique index. Those effects require a deliberate migration plan and owner approval.

## 4. Backup, rollback and safety plan — STOP before execution

**Backup/recovery availability: UNKNOWN.** The enabled connector lists projects, migrations and SQL tools but offers no backup/recovery-point listing tool. Project metadata and SQL catalogs do not establish whether a usable provider backup/PITR or off-site export exists. The owner must check the intended project's Supabase dashboard, plan, timestamp, retention and restore procedure, and verify a restore on an isolated environment before any migration. Do not assume the empty connected project represents existing data in the configured project.

Proposed sequence, not approved or executed:

1. Confirm which Supabase project is intended and grant read-only access to that project. Inventory actual users, profile/game tables, policies, exact grants/memberships, triggers/functions and migration history there without exporting credentials. Check GitHub Pages impact and decide whether to disable or retain the already-published cloud controls; do not change production without approval.
2. Confirm a recent recoverable backup/PITR and independently test recovery in a separate staging environment. Preserve existing profiles/game data and take an exact snapshot of schema, policies and grants. Confirm Auth redirects/provider/SMTP settings without publishing secrets.
3. Reconcile the intended migration history with the existing schema. Design a **reviewed revised migration** for that schema: add only necessary missing columns, handle the actual broad policy name and existing grants deliberately, preserve any required public-profile or `avatar_url` behavior, and avoid replacing unrelated signup triggers. Check for case-insensitive username collisions before introducing a unique index. Do not apply 001–005 blindly.
4. Apply the reviewed plan only to a staging copy; test two users, anon, sign-up, profile updates, snapshot isolation, real PostgREST response/error shapes, parallel CAS, quota, offline/restore and rollback. Confirm policy/grant changes cannot expose other users' data or break existing Auth/profile clients.
5. Present the final exact SQL, backup evidence, rollback SQL/runbook and staged results for explicit user approval. Stop before executing any live SQL or deploying the Worker.

**Exact SQL currently proposed by the merged repository** is reproduced verbatim in the appendix below for review. It is **not safe to execute on the connected project as-is**, particularly 005. 004's `CREATE`, `ALTER ... ENABLE ROW LEVEL SECURITY`, `REVOKE`, `GRANT`, `DROP POLICY`, `CREATE POLICY`, and `CREATE OR REPLACE FUNCTION` change metadata/permissions; its function writes snapshot/history rows when subsequently invoked. 005 changes policy and grants. Policy drops, function replacement and privilege changes require recording and restoring exact prior definitions/grants for rollback; running inverse SQL without a verified backup may expose data or destroy newer snapshots. Dropping snapshot tables for rollback would destroy stored snapshots and is **not** proposed. `ON DELETE CASCADE` makes future user deletion irreversible without recovery. No statement in 004/005 intentionally deletes existing profiles or existing game rows, but we cannot verify that property for an inaccessible different target schema or all dependent clients.

## 5. Cloudflare Worker and frontend

- The URL configured in the frontend is `https://arkid-api.nova-197b21.workers.dev`. A public read via `fetch_page` of `/health` returned JSON `{"status":"ok","service":"arkid-api","version":"1.0.0"}`. An unauthenticated read of `/v1/me` returned `{"error":"Authentication required"}`. The fetch tool did not provide reliable HTTP status or CORS response headers; these results establish observable endpoint responses only, not successful authentication.
- Merged Worker source returns `{ok:true, service:"arkid-api", version:1}` on health and a different unauthenticated error shape. Therefore the deployed endpoint's observed payload is **not compatible with the exact merged source response shape**. This is evidence of a different/stale deployment or code/configuration, not proof of its deployment history. The newly merged cloud test displays `result.ok`, which may be undefined against the observed response.
- The Cloudflare connector lookup returned `unsupported`; there was no Worker account/configuration access. The checked-in `worker/wrangler.toml` points to `kttefkhuchbufobdgdhi` and lists GitHub Pages and localhost:8787 as allowed origins, but deployed env vars, publishable key, Worker version and exact CORS headers cannot be verified from source alone. A sandbox `curl` preflight with the Pages origin failed with `SSL_ERROR_SYSCALL` (exit 35); it did not demonstrate a server-side CORS failure. No authenticated test with a user token was performed.
- To match merged code the Worker likely needs configuration review and redeployment, but **do not redeploy yet**. With authorized Cloudflare access, verify actual settings and project identity, test real GET/preflight CORS from the Pages origin and `/v1/me` with valid and invalid user sessions, then seek explicit deployment approval. Do not expose service-role keys or token values.
- The live Pages deployment occurred automatically as stated above. The browser code targets the other Supabase project; 004/005 application there is unknown. No claim is made that cloud backup currently works on the deployed site.

## 6. Remaining actions and blockers

1. **Owner decision:** identify the correct Supabase project, resolve the `uirt...` vs `ktte...` mismatch, and provide the appropriate read-only access. Do not change frontend configuration or database until identity is confirmed.
2. **Urgent Pages decision:** review the automatically published integration-branch site and whether its newly exposed cloud controls should remain. Any rollback, deploy, Pages config change or live modification needs explicit approval. Note that cloud backup targets the unverified configured project.
3. Verify an actual restorable backup/recovery point for the chosen project; document and test rollback. The connector cannot verify backup availability.
4. Reconcile migrations with the real schema and actual RLS/grants, including missing columns and the broad policy, in staging; obtain approval for an exact non-destructive production plan.
5. Grant Cloudflare read-only access if available; inspect deployed Worker variables/code and test CORS/auth before asking for deployment approval.
6. Perform real browser/offline, account-switch, concurrent restore and gameplay testing. Close other game tabs during backup/restore; the code's best-effort checks do not make localStorage atomic.

## Appendix: exact merged migration SQL — review only, DO NOT EXECUTE

The following are copies of the current repository files. They are included to identify exact proposed database changes, not as an instruction or authorization to run them.

### `supabase/migrations/004_cloud_snapshots.sql`

```sql
-- Explicit, whole-device snapshots. The client is not trusted to mutate revisions.
-- No gameplay balance is authoritative; snapshots are private user-controlled backups.
create table if not exists public.arkid_cloud_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint arkid_snapshot_size check (octet_length(data::text) <= 2097152)
);
create table if not exists public.arkid_cloud_snapshot_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision uuid not null,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (user_id, revision)
);
alter table public.arkid_cloud_snapshots enable row level security;
alter table public.arkid_cloud_snapshot_history enable row level security;
revoke all on public.arkid_cloud_snapshots, public.arkid_cloud_snapshot_history from public, anon, authenticated;
grant select on public.arkid_cloud_snapshots, public.arkid_cloud_snapshot_history to authenticated;
drop policy if exists "Read own snapshot" on public.arkid_cloud_snapshots;
create policy "Read own snapshot" on public.arkid_cloud_snapshots for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Read own snapshot history" on public.arkid_cloud_snapshot_history;
create policy "Read own snapshot history" on public.arkid_cloud_snapshot_history for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.arkid_save_snapshot(expected_user uuid, expected_revision uuid, snapshot jsonb)
returns public.arkid_cloud_snapshots
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  old_row public.arkid_cloud_snapshots;
  new_row public.arkid_cloud_snapshots;
begin
  if uid is null or uid is distinct from expected_user then raise exception 'account changed' using errcode = '42501'; end if;
  if snapshot is null or jsonb_typeof(snapshot) <> 'object'
    or snapshot->>'schema' is distinct from '1'
    or jsonb_typeof(snapshot->'storage') is distinct from 'object'
    or octet_length(snapshot::text) > 2097152 then
    raise exception 'invalid snapshot' using errcode = '22023';
  end if;
  -- Serialize even the first insert for this user; comparison and write are atomic.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  select * into old_row from public.arkid_cloud_snapshots where user_id = uid;
  if old_row.user_id is null then
    if expected_revision is not null then raise exception 'snapshot conflict' using errcode = '40001'; end if;
    insert into public.arkid_cloud_snapshots(user_id, revision, data)
      values (uid, pg_catalog.gen_random_uuid(), snapshot) returning * into new_row;
  else
    if expected_revision is distinct from old_row.revision then raise exception 'snapshot conflict' using errcode = '40001'; end if;
    insert into public.arkid_cloud_snapshot_history(user_id, revision, data, updated_at)
      values (uid, old_row.revision, old_row.data, old_row.updated_at);
    update public.arkid_cloud_snapshots set revision = pg_catalog.gen_random_uuid(), data = snapshot, updated_at = now()
      where user_id = uid returning * into new_row;
  end if;
  return new_row;
end;
$$;
revoke all on function public.arkid_save_snapshot(uuid, uuid, jsonb) from public, anon;
grant execute on function public.arkid_save_snapshot(uuid, uuid, jsonb) to authenticated;

```

### `supabase/migrations/005_profile_privacy.sql`

```sql
-- The application only reads the current user's profile. Avoid exposing any
-- legacy/private columns to every signed-in user via select('*').
drop policy if exists "Authenticated users can view profiles" on public.profiles;
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
-- Do not allow clients to change id, timestamps, or unreviewed legacy columns.
revoke update on public.profiles from authenticated;
grant update (username, display_name, bio, avatar_path) on public.profiles to authenticated;

```
