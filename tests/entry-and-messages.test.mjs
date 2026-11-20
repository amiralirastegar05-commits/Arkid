import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { isGameKey } from '../cloud/snapshot.js';

const entryCode = await readFile(new URL('../cloud/entry-gate.js', import.meta.url), 'utf8');
const messageCode = await readFile(new URL('../cloud/messages.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function setup(keys = []) {
  const storage = new Map(keys.map(k => [k, 'existing']));
  const gate = {hidden:true};
  const button = {addEventListener(type, fn) { assert.equal(type,'click'); this.click=fn; }};
  const document = {documentElement:{dataset:{}}, getElementById(id) {return id === 'arkidEntryGate' ? gate : id === 'arkidEntryStart' ? button : null;}};
  const localStorage = {get length() {return storage.size;}, key(i) {return [...storage.keys()][i] ?? null;}};
  const window = {};
  vm.runInNewContext(entryCode,{window,document,localStorage});
  return {window,document,gate,button,storage};
}
test('fresh entry waits for the player before the hub initialises, without writing game data', async () => {
  const ctx = setup(['sb-example-auth-token','unrelated']);
  assert.equal(ctx.document.documentElement.dataset.arkidEntry,'pending');
  ctx.window.arkidShowEntryGate();
  assert.equal(ctx.gate.hidden,false);
  let resolved = false;
  ctx.window.arkidEntryGate.then(() => { resolved = true; });
  await Promise.resolve(); assert.equal(resolved,false);
  ctx.button.click(); await ctx.window.arkidEntryGate;
  assert.equal(ctx.gate.hidden,true);
  assert.equal(ctx.document.documentElement.dataset.arkidEntry,undefined);
  assert.deepEqual([...ctx.storage.keys()],['sb-example-auth-token','unrelated']);
  assert.ok(html.indexOf('src="cloud/entry-gate.js"') < html.indexOf('if (window.arkidEntryGate) await window.arkidEntryGate;'));
  assert.ok(html.indexOf('if (window.arkidEntryGate) await window.arkidEntryGate;') < html.indexOf('saveProfile(getProfile());'));
});
test('existing progress, active game and old cloud bindings never trigger a fresh-start gate', () => {
  const keys=['arcade_points','arcade_profile','arcade_active_session','arkid_cloud_snapshot_meta_v1','2048_settings_v1','ast_achv_v1','bk_stats_v1','mk_tut_seen','mp_progress_v1','rr_stats_v3','pong_stats_v1','snake_hs_v1','si_scores_v1','tr_stats_v1','arcade-runner_progress_v1','ar_tutorial_v2_steps','GameRunnerSave'];
  for (const key of keys) {
    if (!['arcade_active_session','arkid_cloud_snapshot_meta_v1'].includes(key)) assert.equal(isGameKey(key),true,key);
    const ctx = setup([key]);
    assert.equal(ctx.window.arkidEntryGate,undefined,key);
    assert.equal(ctx.storage.get(key),'existing');
  }
});
test('friendly errors explain key actions without displaying raw server data', () => {
  const ctx={};ctx.globalThis=ctx;vm.runInNewContext(messageCode,ctx);
  const message=ctx.ArkidMessages.message;
  assert.match(message({message:'Local game data already exists. Restore is blocked to protect it.'},'restore'),/از قبل پیشرفت/);
  assert.match(message({message:'Restore failed and rollback was incomplete; do not clear storage'},'restore'),/چیزی را پاک نکن/);
  assert.match(message({message:'snapshot history full'},'upload'),/پر شده/);
  assert.match(message({code:'invalid_credentials',message:'anything'},'login'),/ایمیل یا گذرواژه/);
  assert.doesNotMatch(message({message:'Sensitive server detail 123'},'restore'),/Sensitive|123/);
  assert.match(message({message:'network fault'},'upload'),/ممکن است در ابر ذخیره شده باشد/);
});
