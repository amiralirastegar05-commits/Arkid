import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collect, validate, upload, restoreEmpty, META_KEY } from '../cloud/snapshot.js';
class Storage {
  constructor(data = {}) { this.data = new Map(Object.entries(data)); }
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k,v) { this.data.set(k,String(v)); }
  removeItem(k) { this.data.delete(k); }
}
function client() {
  let row = null, n = 0, failAfterWrite = false;
  return {
    from() { return { select() { return this }, eq(_key, user) { this.user = user; return this }, async maybeSingle() { return { data: row?.user === this.user ? row : null, error: null }; } }; },
    async rpc(_name, {expected_user, expected_revision, snapshot}) {
      if ((row?.revision ?? null) !== expected_revision) return { error: Error('conflict') };
      row = { user: expected_user, revision: String(++n), data: structuredClone(snapshot) };
      if (failAfterWrite) { failAfterWrite = false; throw Error('network'); }
      return { data: row, error: null };
    },
    set failNext(v) { failAfterWrite = v; }, get row() { return row; }
  };
}
test('captures known progress without auth, transient or unrelated keys', () => {
  const storage = new Storage({ arcade_profile:'{"xp":9}', arcade_points:'10', 'arcade-runner_inventory_v1':'{"coins":2}', GameRunnerSave:'{}', arcade_active_session:'{}', 'sb-project-auth-token':'secret', unrelated:'private' });
  assert.deepEqual(Object.keys(collect(storage).storage).sort(), ['GameRunnerSave','arcade-runner_inventory_v1','arcade_points','arcade_profile'].sort());
  assert.throws(() => validate({schema:1,storage:{'sb-project-auth-token':'secret'}}));
});
test('first migration, unchanged retry, conflict, and account isolation', async () => {
  const db = client(), one = new Storage({arcade_points:'10'}), two = new Storage({arcade_points:'15'});
  await upload(db,'user1',one);
  assert.equal((await upload(db,'user1',one)).unchanged,true);
  await assert.rejects(upload(db,'user1',two), /conflict/);
  await assert.rejects(upload(db,'user2',one), /different account/);
  one.setItem('arcade_points','9'); await upload(db,'user1',one);
  assert.equal(db.row.data.storage.arcade_points,'9');
  await assert.rejects(upload(db,'user1',two), /conflict/);
});
test('ambiguous network result reconciles without a duplicate write', async () => {
  const db = client(), local = new Storage({arcade_points:'10'});
  db.failNext = true;
  await assert.rejects(upload(db,'user1',local),/network/);
  assert.equal((await upload(db,'user1',local)).unchanged, true);
  assert.equal(db.row.revision,'1');
});
test('restore refuses existing progress and preserves non-game keys', () => {
  const remote = {revision:'r1',data:{schema:1,storage:{arcade_points:'20', arcade_profile:'{"xp":3}'}}};
  const occupied = new Storage({arcade_points:'100'});
  assert.throws(() => restoreEmpty(occupied,'user',remote),/already exists/);
  assert.equal(occupied.getItem('arcade_points'),'100');
  const clean = new Storage({'sb-project-auth-token':'token'});
  restoreEmpty(clean,'user',remote);
  assert.equal(clean.getItem('arcade_points'),'20'); assert.equal(clean.getItem('sb-project-auth-token'),'token');
  assert.equal(JSON.parse(clean.getItem(META_KEY)).revision,'r1');
});
test('failed restore rolls back inserted keys and keeps unrelated values', () => {
  const local = new Storage({other:'stay'});
  const set = local.setItem.bind(local);
  local.setItem = (k,v) => { if(k === 'arcade_profile') throw Error('quota'); set(k,v); };
  assert.throws(() => restoreEmpty(local,'user',{revision:'r',data:{schema:1,storage:{arcade_points:'20',arcade_profile:'{}'}}}), /quota/);
  assert.equal(local.getItem('arcade_points'), null); assert.equal(local.getItem('other'),'stay');
});
