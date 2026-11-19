# Arkid cloud migration: verified status report

**Snapshot date:** 2026-11-19 UTC

**Repository:** `amiralirastegar05-commits/Arkid`

**Scope:** previous migration work plus this verification/reporting task. This is a source and local-test audit, not a verification of the live Cloudflare or Supabase projects. No implementation changes were made during this reporting task.

## Follow-up PR review — 2026-11-19 UTC

This section updates the historical point-in-time report below; the older commit IDs, file counts and test counts remain records of the earlier verification. At follow-up start, GitHub REST reported PR #1 `mergeable=true`, `mergeable_state=clean`, draft, base `4b625d01d9fceeb6367ca25adf43fdea016d9049`, head `f9d66c308d9c6c744c29e8f0a4b5af0563c70e72`, with no reported status checks. `git merge-base` returned the base, `git rev-list --left-right --count` returned `0 6`, and `git merge-tree --write-tree` succeeded. No conflict or stale base was found. The earlier user-reported `mergeable=false` was not reproduced and its precise cause cannot be determined from available evidence; asynchronous GitHub recalculation is a possibility, not an established fact. A `git fetch` inspection initially tried `origin/cloud-integration-phase1`, which is absent from this checkout's restricted fetch refspec; a direct base SHA comparison succeeded. No branch was switched, reset or merged.

The follow-up reviewed all 19 PR files and strengthened specific snapshot problems: session/binding checks around async upload and download; active-session blocking; revision validation; checks for changed data/binding during restore; explicit incomplete-rollback reporting; and a warning if the hub develops in-memory-only changes during upload. The service-worker cache version was bumped again. Tests additionally cover mocked account switching, concurrent binding/data changes, incomplete rollback and a one-row RPC result, plus more PGlite privileges/CAS cases. After these changes `npm test` passed **19/19** locally (15 snapshot unit tests, one PGlite test, three Worker tests). These checks are not real browser, live Supabase, Cloudflare or multi-process concurrency tests. See `CLOUD_MIGRATION_AUDIT.md` for SQL 004/005 deployment risks.

Migration 004/005 were reviewed but not changed or run on live services. Snapshot history remains unbounded, values are client-controlled and localStorage checks do not provide cross-tab atomicity; account switch after a cloud commit can leave the server updated even if the client reports failure. No automatic conflict merge was added. Use `git rev-parse HEAD` for the current follow-up commit SHA; this file cannot include its own eventual commit SHA without changing it.

## 1. Git and GitHub evidence

- **Actual working branch:** `arena/0b5bf391-arkid`. The Arena session fixes work to that branch. The user-requested target branch `cloud-integration-phase1` was used as the PR base, not checked out or directly modified. No branch switch, merge, force push, or reset was performed.
- **Parent/base at start of both tasks:** `4b625d01d9fceeb6367ca25adf43fdea016d9049` on `cloud-integration-phase1`.
- **Implementation HEAD immediately before this report was created:** `e6b80a67e578036c8819ce76b91d66a0545a0720`. The report is intended to be one subsequent commit. A committed file cannot contain its own eventual commit hash without changing that hash; obtain the actual current HEAD with `git rev-parse HEAD` and the report commit with `git log -1 --format=%H -- ARENA_STATUS_REPORT.md`.
- **GitHub verification before report commit:** `git ls-remote` returned `e6b80a67e578036c8819ce76b91d66a0545a0720` for `refs/heads/arena/0b5bf391-arkid` and `4b625d01d9fceeb6367ca25adf43fdea016d9049` for `refs/heads/cloud-integration-phase1`. Thus the five implementation commits actually exist on GitHub, but are not on the target branch as of that check.
- **PR:** [#1](https://github.com/amiralirastegar05-commits/Arkid/pull/1), open, draft, base `cloud-integration-phase1`, head `arena/0b5bf391-arkid`, head SHA `e6b80a67e578036c8819ce76b91d66a0545a0720` at verification time. `gh pr view` reported `MERGEABLE` and an empty `statusCheckRollup`; an empty check list is **not** evidence that CI passed.
- **Working tree before writing this report:** clean (`git status --short --branch` showed no tracked/untracked changes). `node_modules/` existed and was ignored. This file is the sole intended new tracked change in the reporting task. Its eventual commit/push outcome must be checked with Git; the final response supplies the post-commit SHA and reports any push failure.

### Implementation commits created in the previous task

| SHA | Subject | Files touched by that commit |
| --- | --- | --- |
| [97d99f9dcde6815c6ed0de9466b58b9234d5be9d](https://github.com/amiralirastegar05-commits/Arkid/commit/97d99f9dcde6815c6ed0de9466b58b9234d5be9d) | Fix public health checks and handle auth connectivity failures | `cloud/cloud-test.html`, `worker/src/index.js`, `worker/test/index.test.js` |
| [1806a5f5cf6e81542a5097d285eeda64249b0f82](https://github.com/amiralirastegar05-commits/Arkid/commit/1806a5f5cf6e81542a5097d285eeda64249b0f82) | Add opt-in revision-checked cloud snapshots and safe empty-device restore | `auth.js`, `cloud/arcade-auth.js`, `cloud/restore.html`, `cloud/snapshot.js`, `supabase/migrations/004_cloud_snapshots.sql`, `sw.js`, `tests/snapshot.test.mjs` |
| [cec1a23607f9e3a725d4f41927d90b18b18d5535](https://github.com/amiralirastegar05-commits/Arkid/commit/cec1a23607f9e3a725d4f41927d90b18b18d5535) | Protect auth credentials in backups and restrict profile access | `index.html`, `supabase/migrations/005_profile_privacy.sql` |
| [81a9c78cd203cda8bb227d335f4e337c4370ad2c](https://github.com/amiralirastegar05-commits/Arkid/commit/81a9c78cd203cda8bb227d335f4e337c4370ad2c) | Harden snapshot recovery and add reproducible database tests | `.gitignore`, `auth.js`, `cloud/restore.html`, `cloud/snapshot.js`, `index.html`, `package-lock.json`, `package.json`, `tests/snapshot.test.mjs`, `tests/sql.test.mjs` |
| [e6b80a67e578036c8819ce76b91d66a0545a0720](https://github.com/amiralirastegar05-commits/Arkid/commit/e6b80a67e578036c8819ce76b91d66a0545a0720) | Document cloud migration audit and safe rollout | `AUTH_SETUP-fa.md`, `CLOUD_MIGRATION_AUDIT.md` |

The GitHub PR lists both the repository owner and `arena-agent` as authors/co-authors. The commit subjects above are the local Git subjects. The report-only commit is not one of the five implementation commits; use the Git command above to identify it.

### Complete net file list relative to base

`git diff --name-status --find-renames 4b625d01d9fceeb6367ca25adf43fdea016d9049...e6b80a67e578036c8819ce76b91d66a0545a0720` reported 18 files: 11 added and 7 modified, no deleted or renamed files. The current reporting task adds the nineteenth file listed last below.

| Status | Path | Precise net change |
| --- | --- | --- |
| Added | `.gitignore` | Ignores root `node_modules/`. |
| Modified | `AUTH_SETUP-fa.md` | Appended Persian instructions identifying manual cloud backup, empty-browser restore and the audit guide. The older assertions about deployed provider/database state were not independently checked. |
| Added | `CLOUD_MIGRATION_AUDIT.md` | Architecture, storage mapping, design rationale, limitations and proposed rollout/testing checklist. It is a source-based audit, not live configuration evidence. |
| Modified | `auth.js` | Signed-in account dialog explains manual backups, adds upload and restore link; upload asks confirmation, blocks known hub in-memory fallback state, calls snapshot upload and reports result/errors; Worker check guards against a missing session. |
| Modified | `cloud/arcade-auth.js` | Imports `snapshot.js` and exposes its module on `window.ArkidAuth.snapshots`; existing Auth URL, publishable key and authentication behavior otherwise remain. |
| Modified | `cloud/cloud-test.html` | Attempts Worker health even if Auth import failed, shows returned `service`/`ok` instead of nonexistent `status`, and includes non-2xx HTTP status in the display. |
| Added | `cloud/restore.html` | Persian standalone page to sign in with email/password or use an existing session, download current snapshot, and request restore to an empty browser; checks session identity again before restore. |
| Added | `cloud/snapshot.js` | Explicit localStorage key allowlist; collect/validate raw string snapshots, read remote, account/revision metadata, upload with compare-and-swap, unchanged-response reconciliation, changed-local-data signal, and empty-browser restore with attempted rollback. No automatic merge or background sync. |
| Modified | `index.html` | Exposes whether hub `localMemory` contains unsaved values; developer export prefers those newer in-memory values and removes matching auth/PKCE and cloud-binding keys; import preserves those protected keys, ignores them in file, invalidates an existing binding revision, and adjusts warnings. Import still replaces other localStorage keys. |
| Added | `package.json` | Root Node test script and pinned `@electric-sql/pglite` 0.5.16 development dependency; `type: module`. |
| Added | `package-lock.json` | npm lockfile for the root test dependency. |
| Added | `supabase/migrations/004_cloud_snapshots.sql` | Defines current/history snapshot tables, size constraint, RLS own-read policies and grants, and a security-definer RPC with user check, advisory lock, revision comparison and history insert. |
| Added | `supabase/migrations/005_profile_privacy.sql` | Replaces the named broad profile SELECT policy with an own-row policy; revokes table-level authenticated UPDATE and grants update to `username`, `display_name`, `bio`, `avatar_path`. Other live policies/grants are not automatically removed. |
| Modified | `sw.js` | Bumps `arcade-2026-11-v3` to `v4`; adds `cloud/snapshot.js` and `cloud/restore.html` to same-origin core cache list. |
| Added | `tests/snapshot.test.mjs` | Six Node tests with in-memory mocked storage and a mock Supabase-style client. |
| Added | `tests/sql.test.mjs` | One PGlite test applying migrations 001–005 against mock Auth roles/users and exercising selected CAS, privilege and RLS cases. |
| Modified | `worker/src/index.js` | Public GET `/health` returns wildcard CORS before origin allowlist; other routes retain allowlist; auth network failure, HTTP 429 and 5xx map to 503; blocked-origin and no-origin responses include `Vary: Origin`. |
| Added | `worker/test/index.test.js` | Three Node unit tests for public health, allowed/blocked identity preflight and mocked auth identity/outage behavior. |
| Added in this task | `ARENA_STATUS_REPORT.md` | This report; documentation only. It was uncommitted at the time of writing and is intended to be committed and pushed on the fixed experimental branch. |

### Temporary/ignored work, not GitHub deliverables

During the prior task `/tmp/arkid-storage.txt` was used for search output; `/tmp/arkid-pg/` held a temporary PGlite installation and `check.mjs` experiment; Python `tempfile` files held extracted scripts for syntax checks. `/tmp` files are outside the repository and are not tracked. Root `node_modules/` is ignored and was installed in the sandbox; it is not in the commit. These files may not survive sandbox snapshots. No user database was changed and no production service was deployed by these commands.

## 2. Verification and test results

### Results rerun during this reporting task

Environment: Node `v22.22.3`, npm `10.9.8`; existing ignored `node_modules/` was present. `npm test` exited **0**, TAP summary **10 tests, 10 pass, 0 fail, 0 skipped**. It runs exactly `node --test tests/*.test.mjs worker/test/*.test.js`:

1. Known progress capture excludes example auth, transient and unrelated keys — **PASS** (mock storage).
2. Initial migration, unchanged retry, divergent cloud conflict and other-account binding — **PASS** (mock client/storage).
3. A simulated lost response reconciles equal data without a second mock write — **PASS** (mock client/storage).
4. Restore refuses occupied storage and preserves a non-game auth key — **PASS** (mock storage).
5. A simulated quota error rolls back inserted keys — **PASS** (mock storage; rollback failure itself not tested).
6. Local change during an unchanged remote read is reported — **PASS** (mock client/storage).
7. Migrations 001–005 apply to PGlite with synthetic Auth users/roles; insert, stale create rejection, account mismatch rejection, update/history, own profile visibility, blocked timestamp update and delete, other-user snapshot/history invisibility — **PASS**. This is PostgreSQL WASM, not live Supabase, PostgREST or a real concurrent-load test.
8. Public health response shape and wildcard origin — **PASS** (Worker handler called in Node).
9. Configured and unconfigured origins for identity preflight — **PASS** (Node Request/Response, not a browser).
10. Missing/bad credentials, mocked valid identity and network exception — **PASS** (mocked fetch). The test name mentions auth outages; it tests a thrown network error, not actual HTTP 429/5xx branches.

Other checks in this task:

- `git diff --check 4b625d01d9fceeb6367ca25adf43fdea016d9049 HEAD` — no whitespace errors printed. The compound shell command also ran `node --check` on `auth.js`, `cloud/snapshot.js`, `cloud/arcade-auth.js`, `worker/src/index.js`, `sw.js`; no syntax errors printed. The command used `;`, so its final `echo` alone would not establish earlier exit codes; the absence of error output is the observed evidence.
- Python `HTMLParser` extracted inline scripts from root and `cloud/` HTML into temporary `.mjs` files and ran `node --check` on each: **21 checked, 0 failures**, exit 0. This parses all extracted scripts as modules; it is not browser execution or a faithful check of all classic-script semantics.
- `gh pr view`, `git ls-remote`, `git log`, `git diff --name-status`, `git status`, `git show`, `git ls-files`, and `rg` inspections verified repository/PR/file/source facts above. They are inspections, not functional tests. No status checks were reported by GitHub.

### Prior task test and validation chronology, including failures

- `node --test worker/test/*.test.js`: **3/3 passed**, exit 0 after the Worker change.
- `node --test tests/snapshot.test.mjs worker/test/index.test.js`: **8/8 passed**, exit 0 after initial snapshot tests; repeated with `worker/test/*.test.js`, also **8/8 passed**. At that time these were five snapshot mock tests plus three Worker tests, not the later database test.
- `npm install --prefix /tmp/arkid-pg @electric-sql/pglite --no-audit --no-fund`: **1 package added**, exit 0. This was temporary, not a deployment or a test of the npm lockfile.
- Initial `node /tmp/arkid-pg/check.mjs`: migrations 001–005 applied in PGlite but the diagnostic then **failed with `snapshot conflict`, exit 1**. The diagnostic called a volatile composite-returning function as `select (function(...)).*`; PostgreSQL expanded it into multiple calls, so the later call conflicted. The diagnostic query was changed to `select * from function(...)`; no production SQL change was made for that diagnostic error.
- `node /tmp/arkid-pg/check.mjs 2>&1 | tail -30`: printed all five migrations applied, stale insert rejected, one history row, account mismatch rejected, one own profile visible, timestamp update rejected, and zero other-user snapshots. The pipeline reported exit 0, but without `pipefail` that alone is not proof of the Node command's exit status. The subsequent committed `tests/sql.test.mjs` runs independently under `npm test` without this pipeline.
- `npm install --no-audit --no-fund` in the root: **1 package added**, exit 0; created ignored `node_modules/` and lockfile. `npm test` then passed **9/9**, followed by **10/10** after adding the local-change test; `npm test` was rerun twice with **10/10** after that, including the final previous-task check.
- `node --check auth.js; node --check cloud/snapshot.js`: no errors printed. A Python `HTMLParser`/temporary `.mjs` extraction then reported **21 inline scripts checked, 0 failures**. No browser was run.
- `git diff --check` before the final implementation commits and `git diff --check HEAD^ HEAD` at the previous-task end printed no errors. `git push -u origin arena/0b5bf391-arkid` and `gh pr create --base cloud-integration-phase1 --head arena/0b5bf391-arkid --draft ...` succeeded; PR #1 was created, not merged.
- Previous source inspection command `cat supabase/migrations/*.sql; cat supabase/*md; cat AUTH_SETUP-fa.md; cat sw.js` printed **`cat: 'supabase/*md': No such file or directory`** because there was no matching Markdown file. Subsequent `cat` commands continued and the compound shell exited 0; this was an inspection error, not a test success.
- This reporting task initially requested unsupported `baseRefOid` from `gh pr view`, which printed **`Unknown JSON field: "baseRefOid"`**. The surrounding semicolon-separated command continued and returned 0; it was rerun using supported fields and `git ls-remote` for the base SHA.

### Other executed command inventory

The following were non-test audit/edit commands in the previous task; grouped here to avoid reproducing large inline source-writing heredocs as if they were test results:

- Repository inventory: `pwd`, `git status --short --branch`, `git log -5 --oneline`, `ls -la`, `find . -maxdepth 3 -type f ...`, `git remote -v`, `git log --oneline --all -8`, `git status --short`, and `command -v psql`, `command -v docker`, `command -v postgres`, `command -v chromium`, `command -v chromium-browser` (the tools checked produced no path for those binaries at the time).
- Source inspection used `cat` on Worker, Auth, cloud test, migrations, service worker, manifests and documentation; `sed -n` on hub storage/backup/economy, game and service-worker snippets; `rg -n`/`rg -o` searches for localStorage/sessionStorage/IndexedDB, key names, Auth, economy, SW registration and gameplay; Python string/regex snippets examined minified Arcade Runner save keys. Search output was sometimes truncated by the tool and was not a formal exhaustive gameplay test.
- Python heredocs and shell `cat > ... <<'EOF'` created/edited the implementation and tests listed in section 1; `mkdir -p`, `sed -i`, `printf`, `node -p "require('/tmp/arkid-pg/node_modules/@electric-sql/pglite/package.json').version"` (returned `0.5.16`), and `git add`/five `git commit -m ...` calls produced the commits listed. `gh auth status` reported an authenticated GitHub account; credentials were not requested or stored in chat.
- This task additionally ran the Git/GitHub, source inspection, `npm test`, `node --check` and Python syntax-extraction commands described above. The report was created with a shell heredoc. The first `git diff --no-index --check /dev/null ARENA_STATUS_REPORT.md` printed two trailing-whitespace warnings; the compound command ended with `true`, masking that check's exit code. The two lines were subsequently corrected; rerunning the no-index check printed no warnings but returned 1 because the compared files differ. The outcome of the report commit and push must be read from Git and the final response.

### Not tested

No real browser, gameplay session, fresh-device restore, mobile browser, service-worker installation/upgrade, offline gameplay, OAuth callback, email delivery, live Supabase Auth/PostgREST/RLS, live Cloudflare Worker, production CORS, real multi-client SQL concurrency, Cloudflare deploy, production migration, load/rate-limit, security penetration test, build or `npm ci` was executed. No end-to-end proof exists that existing local progress survives every storage/quota/interruption case. The exact live reason for failed health/CORS is unknown. Static key inspection does not prove the allowlist captures every legacy/future state.

## 3. Cloud migration status matrix

Status values below describe the **repository implementation and evidence**, not an assertion that it is deployed. `IMPLEMENTED AND VERIFIED` would require verification appropriate to the whole feature; local unit coverage alone is not end-to-end verification.

| Item | Status | Evidence, limitations and next verification |
| --- | --- | --- |
| Supabase Auth | PARTIALLY IMPLEMENTED | Browser Supabase client persists sessions, refreshes tokens, and exposes signup/sign-in/sign-out/session/user. The client is loaded from esm.sh; neither live project nor browser flows were tested. `isConfigured()` is only a string check, not connectivity validation. |
| Google OAuth | IMPLEMENTED BUT NOT VERIFIED | OAuth method/button exist. Existing `AUTH_SETUP-fa.md` says provider was disabled and requires Google credentials/callback, but that is an old repository assertion, not current dashboard evidence. No OAuth test; restore page itself has no Google button. |
| Email authentication | IMPLEMENTED BUT NOT VERIFIED | Email/password signup and sign-in exist. Existing docs say email provider was enabled and recommend SMTP; current settings, confirmation delivery and sign-in are unverified. |
| Worker deployment and endpoint | BLOCKED | Checked-in source defines public `/health` and authenticated `/v1/me`; frontend points to `https://arkid-api.nova-197b21.workers.dev`. Existing docs say a Worker was deployed, but its present existence/version/configuration were not checked. No Cloudflare project deployment access exercised. |
| Worker CORS | PARTIALLY IMPLEMENTED | Source: public GET `/health` uses `*`; `/v1/me` and preflight use exact `ALLOWED_ORIGINS` and bearer token. Local handler unit tests pass. Checked-in list includes GitHub Pages origin and `http://localhost:8787` only; actual frontend port/custom domain/preview and deployed variables may differ. Browser/live CORS untested. |
| Profile creation and persistence | PARTIALLY IMPLEMENTED | Migration 001 has Auth insert trigger and timestamp trigger; client has `getProfile()` using `.single()`. PGlite synthetic new-user test sees one profile. Existing Auth users are not backfilled by the migration; hub profile/XP is separate localStorage and is not automatically written to `public.profiles`. No live profile write flow verified. |
| Supabase SQL migrations | PARTIALLY IMPLEMENTED | 001–003 pre-existed; 004 and 005 are committed in PR and passed sequentially on fresh PGlite mock schema. Old docs claim 001–003 were applied live; unverified. 004/005 were not applied to Supabase in this work. Existing schemas may differ despite `CREATE TABLE IF NOT EXISTS`. |
| RLS policies | PARTIALLY IMPLEMENTED | Fresh PGlite verifies selected own-row/profile and snapshot-history isolation/privileges. Live RLS, inherited grants and other policies were not inspected; permissive policies combine with OR. Migration 005 may change compatibility for public profiles. |
| Cloud synchronization | PARTIALLY IMPLEMENTED | Manual opt-in whole-snapshot upload/read directly to Supabase, not via Worker. No automatic/background synchronization, offline upload queue or transaction ledger. Not deployed/end-to-end tested. |
| Conflict resolution | PARTIALLY IMPLEMENTED | Client checks revision; SQL CAS and advisory lock reject stale writes; mock tests and sequential PGlite cases pass. There is no automatic merge or conflict resolution UI, true concurrency test, or reliable detection of all manual local rewinds. |
| Snapshot and backup mechanisms | PARTIALLY IMPLEMENTED | Source includes private current snapshot and history, explicit upload, empty-device restore, cloud file download and developer backup protection. Mock rollback succeeds for one simulated failure. No history selection UI, retention limit or production backup/recovery verification. Developer import still replaces non-protected local data. |
| localStorage compatibility | PARTIALLY IMPLEMENTED | Snapshot retains raw strings and explicitly whitelists identified hub/game keys, excludes auth, unrelated keys, sessionStorage and `arcade_active_session`; only sample keys are tested. Unknown keys, future versions and in-flight state are not migrated. Import/export and actual game compatibility are not browser-tested. |
| XP | PARTIALLY IMPLEMENTED | Hub `arcade_profile` carries XP/level; Runner statistics include its own player XP. Captured as opaque data in recognized keys; no authoritative ledger or XP merge, and no game-level migration verification. |
| Coins | PARTIALLY IMPLEMENTED | Runner inventory stores coins/ownership; other game state may have its own totals. Identified recognized keys are captured as strings. No authoritative coin transaction system or exhaustive end-to-end coverage. |
| Points | PARTIALLY IMPLEMENTED | Hub `arcade_points`, limited history and claim flags are included; server does not validate amounts or transaction authenticity. No duplicate-reward guarantee across manual restore/rewind. |
| Inventory and cosmetics | PARTIALLY IMPLEMENTED | Hub `arcade_inventory`, `arcade_equipped`, Runner inventory and related keys included; no merge or game UI verification. |
| Achievements | PARTIALLY IMPLEMENTED | Hub `arcade_achievements` and identified per-game achievement keys included. Their full restore/award behavior and future keys were not tested. |
| Settings | PARTIALLY IMPLEMENTED | Hub/game settings and gamepad config are in allowlist where identified; unknown/future keys are excluded. Actual device preferences may not be portable and are not browser-tested. |
| Statistics | PARTIALLY IMPLEMENTED | Hub and identified game `*_stats_*`, play counts, high scores and boss counters are included. Opaque snapshot; no automatic merge and no exhaustive gameplay validation. |
| Game saves | PARTIALLY IMPLEMENTED | Identified Runner inventory/progress, `mp_progress_v1`, `GameRunnerSave` and per-game records/settings are included. Exclusion of unlisted keys and in-flight game state can lose information during transfer; not every game was played and restored. |
| Offline support | PARTIALLY IMPLEMENTED | Local gameplay/storage and a same-origin SW exist; network is required for cloud/Auth and esm.sh library. Cache install may succeed with missing assets. Actual offline behavior on each game/device is untested. |
| Service worker compatibility | PARTIALLY IMPLEMENTED | `sw.js` core list/cache version updated; some standalone games attempt blob/data SW registration and Runner registers shared `sw.js`. Browser support, scope interactions, cache update and stale client behavior were not tested. |
| Data migration and rollback safety | PARTIALLY IMPLEMENTED | First upload requires no existing remote; restore refuses recognized existing local data and attempts rollback. This is not atomic localStorage transaction handling; concurrent legacy tabs can write while restore is running, rollback can fail, unknown keys are not checked for conflicts, and manual backup import is destructive. Live migration/rollback not tested. |

### Storage structures and boundaries

- **Hub:** `arcade_profile` (`name`, `avatar`, `joinedAt`, `xp`, `level`), `arcade_points`, `arcade_points_history`, `arcade_inventory.items`, `arcade_equipped`, `arcade_achievements`, `arcade_stats`, settings, gamepad configuration, quest/reward/claim/streak flags, play and score counters. Some values are JSON, while standalone games also write raw numeric strings.
- **Runner:** `arcade-runner_inventory_v1` (coins, owned items, equipment, skills/pets), `arcade-runner_progress_v1`, settings, statistics, achievements, highscores, last name and daily seed; `ar_tutorial_v2_steps`.
- **Other tracked games:** explicit entries for 2048, Asteroids (`ast_`), Breakout (`bk_`), Mushroom Killer (`mk_`), Mushroom Platformer (`mp_`), River Raid/Pacman (`rr_`), Pong, Snake, Space Invaders (`si_`), Tetris (`tr_`), and `GameRunnerSave`; `rr_last_name` is shared. See the exact regular expressions in `cloud/snapshot.js`, not broad prefixes, for authoritative inclusion.
- **Not captured:** Supabase token, unrelated origin keys, sessionStorage, active session/owner, browser caches, in-memory-only or unsaved other-tab state, unknown or new game keys. A hub-only in-memory fallback detector blocks upload if it sees unsaved writes, but cannot see every game tab's memory.

## 4. Prioritized remaining work and blockers

### P0 — prevent deployment/data loss before verification

1. **Owner:** back up the real database and affected player local progress; never clear storage as a shortcut. Keep two divergent snapshots and investigate rather than merging balances or taking maximums.
2. **Owner/operator:** inspect actual Supabase schema, existing `profiles` columns, trigger, migration history, grants, RLS policies, data and dependencies. 001–003 may or may not actually be deployed as old documentation claims; other permissive policies/column-level or inherited grants can defeat the intended policy. Backfill missing profiles only after a reviewed plan. Check migration 005 does not break consumers expecting public reads.
3. **Staging operator:** apply 004 and 005 only after compatibility review, in order after prerequisites 001–003; test authenticated, anonymous, two-user, account-switch and real concurrent-write scenarios in real Supabase/PostgREST. Verify table/function exposure, function return shape, error handling, privilege isolation and history recovery. No production SQL was applied here.
4. **Engineering:** test empty-browser restore, two-tab races, quota and partial rollback, storage disabled, unknown keys, stale/manual local rewinds, failed network, account switches, repeated rewards and the destructive developer import. LocalStorage has no cross-key atomic transaction; warnings do not enforce closing other tabs. Account binding can be removed by clearing browser storage, and manual restores can bypass revision lineage.

### P1 — configure and deploy without secrets in code

5. **Cloudflare operator:** configure `SUPABASE_URL` to the intended project, `SUPABASE_PUBLISHABLE_KEY` to that project's publishable key, and `ALLOWED_ORIGINS` to exact frontend origins including scheme and actual port. Existing `worker/wrangler.toml` lists the project URL and GitHub Pages plus localhost:8787; the Worker runtime key is supplied separately. Never put service-role/secret keys into the browser, repository, report, or chat. Deploy the Worker from `worker/` only after staging review.
6. **Supabase/Google operator:** verify Auth Site URL and allowed redirect URLs for actual site and restore page; enable/configure Google provider and OAuth callback/client credentials securely if desired; verify Email provider, confirmation flow and custom SMTP. The checked-in Persian setup guide is a historical claim, not proof of current dashboard configuration. Test email/password, Google, token refresh, sign-out and redirect flows.
7. **Frontend operator:** after review/deployment of prerequisites, deploy the frontend and confirm `sw.js` update/activation and cache behavior. From the actual frontend origin, independently test public `/health`, authenticated preflight and `/v1/me`; health success does not establish Supabase connectivity. Verify real deployed Worker version and variables.
8. **Player:** explicitly initiate the upload on the correct account after closing other Arkid tabs. For transfer, open `cloud/restore.html` before hub initialization in a fresh browser/profile, sign in and restore. Hub defaults can cause restore to refuse even on an apparently new browser. Download or export both sides before investigating conflicts; a downloaded cloud backup imported with developer tools replaces other local data.

### P2 — security, operational completeness and compatibility

9. Establish abuse controls, rate limits, privacy/retention and recovery procedures. Each successful update archives the old snapshot; history is unbounded and grows. Snapshots contain user data. The RPC size-checks the overall JSON and schema shape but does not validate individual storage keys or values or provide authoritative transaction semantics. An authenticated user can submit malformed or unsupported data for their own snapshot, which the client may later reject.
10. Treat XP/coins/points/inventory as client-editable; there is no trusted server-side ledger, anti-cheat, idempotent cross-device reward system or safe automated merge. Older manually restored data can repeat rewards or revert purchases. A snapshot compare-and-swap does not solve that problem.
11. Audit every key and game on real devices, including future/legacy keys and volatile game state, and verify CDN availability, browser storage, service worker registration/cache upgrades and offline gameplay. Add a reviewed history/conflict recovery UI and a safer non-destructive migration plan if cross-device automatic sync is required.
12. Protect historical exported backup files: old exports may contain active Supabase tokens. Existing/new backups still contain private player data, and the protected-key pattern is a known-key filter rather than a universal secret scanner.

## 5. Verification boundaries and handoff

The strongest verified facts are the GitHub commit/PR state at the recorded snapshot, the committed source diff, and the local automated/syntax results. The test suite does not prove production service health or absence of data loss. This report and `CLOUD_MIGRATION_AUDIT.md` should be read together, with source and actual dashboard state taking precedence over historical claims in setup documentation. No merge into main was performed.
