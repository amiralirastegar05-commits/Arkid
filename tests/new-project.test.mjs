import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { isGameKey, validate, upload, restoreEmpty, META_KEY } from '../cloud/snapshot.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, GOOGLE_SIGN_IN_ENABLED, API_BASE_URL, isConfigured } from '../cloud/config.js';

const one = '00000000-0000-0000-0000-000000000001';
const two = '00000000-0000-0000-0000-000000000002';
const snapshot = storage => JSON.stringify({ schema: 1, storage });

test('new project uses a publishable key and does not target the legacy Worker', () => {
  assert.equal(SUPABASE_URL, 'https://xorsueznslmcmkfqizqn.supabase.co');
  assert.match(SUPABASE_PUBLISHABLE_KEY, /^sb_publishable_/);
  assert.equal(API_BASE_URL, 'https://arkid-api-now.nova-197b21.workers.dev');
  assert.equal(GOOGLE_SIGN_IN_ENABLED, false);
  assert.equal(isConfigured(), true);
});

test('legacy or different project bindings are not silently adopted', async () => {
  const data = new Map([[META_KEY, JSON.stringify({user: 'u', revision: 'r'})], ['arcade_points', '10']]);
  const storage = {getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), key: i => [...data.keys()][i], get length() {return data.size;}};
  const client = {auth: {getSession: async () => { throw Error('must not contact server'); }}};
  await assert.rejects(upload(client, 'u', storage), /another or unknown project/);
  assert.throws(() => restoreEmpty(storage, 'u', {revision:'r', data:{schema:1,storage:{arcade_points:'1'}}}), /another or unknown project/);
  assert.equal(data.get('arcade_points'),'10');
  assert.throws(() => validate({schema:1, storage:{arcade_points:'1'}, extra:'private'}), /Unsupported/);
});

test('fresh migrations enforce privacy, CAS, validation and bounded non-destructive history', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    for (const file of ['001_profiles.sql','002_snapshots.sql']) {
      await db.exec(await readFile(new URL('../supabase/new-project/migrations/' + file, import.meta.url), 'utf8'));
    }
    await db.exec(`insert into auth.users values ('${one}', '{"name":"one"}'), ('${two}', '{}');
      set role authenticated; select set_config('request.jwt.claim.sub','${one}',false);`);
    assert.equal((await db.query('select count(*)::int as n from public.profiles')).rows[0].n, 1);
    assert.equal((await db.query('update public.profiles set display_name=$1 where id=$2 returning id', ['hijack', two])).rows.length,0);
    await assert.rejects(db.query('update public.profiles set created_at=now()'), /permission denied/);
    const data = snapshot({arcade_points:'10'});
    let row = (await db.query('select * from public.arkid_save_snapshot($1,null,$2::jsonb)', [one,data])).rows[0];
    await assert.rejects(db.query('select * from public.arkid_save_snapshot($1,null,$2::jsonb)',[one,data]), /snapshot conflict/);
    await assert.rejects(db.query('select * from public.arkid_save_snapshot($1,$2,$3::jsonb)',[two,row.revision,data]), /account changed/);
    for (const bad of [snapshot({'sb-project-auth-token':'secret'}), snapshot({arcade_points:5}), snapshot({}), JSON.stringify({schema:1,storage:{arcade_points:'1'},extra:'x'}), JSON.stringify({schema:'1',storage:{arcade_points:'1'}})]) {
      await assert.rejects(db.query('select * from public.arkid_save_snapshot($1,$2,$3::jsonb)',[one,row.revision,bad]), /invalid snapshot/);
    }
    // Verify representative frontend keys match the server allowlist; each failed attempt cannot alter revision.
    const keys = ['arcade_profile','arcade_points','arcade_lb_x','arcade_top_game','2048_settings_v1','ast_achv_v1','bk_scores_v1','mk_tut_seen','mp_progress_v1','rr_pacman_stats_v1','pong_last_name','snake_hs_v1','si_scores_v1','tr_stats_v1','arcade-runner_inventory_v1','ar_tutorial_v2_steps','GameRunnerSave','arcade_active_session','sb-project-auth-token','arcade_points_extra'];
    for (const key of keys) {
      const query = db.query('select * from public.arkid_save_snapshot($1,$2,$3::jsonb)',[one,row.revision,snapshot({[key]:'v'})]);
      if (isGameKey(key)) row = (await query).rows[0]; else await assert.rejects(query, /invalid snapshot/);
    }
    await assert.rejects(db.query('insert into public.arkid_cloud_snapshots values ($1,$2,$3::jsonb,now())',[two,row.revision,data]), /permission denied/);
    await db.exec(`select set_config('request.jwt.claim.sub','${two}',false);`);
    assert.equal((await db.query('select count(*)::int as n from public.arkid_cloud_snapshots')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from public.arkid_cloud_snapshot_history')).rows[0].n,0);
    await db.exec(`select set_config('request.jwt.claim.sub','${one}',false);`);
    let count = (await db.query('select count(*)::int as n from public.arkid_cloud_snapshot_history')).rows[0].n;
    while (count < 20) {
      row = (await db.query('select * from public.arkid_save_snapshot($1,$2,$3::jsonb)',[one,row.revision,data])).rows[0];
      count++;
    }
    await assert.rejects(db.query('select * from public.arkid_save_snapshot($1,$2,$3::jsonb)',[one,row.revision,data]), /snapshot history full/);
    assert.equal((await db.query('select revision from public.arkid_cloud_snapshots')).rows[0].revision,row.revision);
    assert.equal((await db.query('select count(*)::int as n from public.arkid_cloud_snapshot_history')).rows[0].n,20);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
    await assert.rejects(db.query('select * from public.arkid_save_snapshot($1,null,$2::jsonb)',[two,data]), /permission denied/);
  } finally { await db.close(); }
});
