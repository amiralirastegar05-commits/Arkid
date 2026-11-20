import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collect, validate, upload, restoreEmpty, captureLocal, replaceLocal, META_KEY } from '../cloud/snapshot.js';
class Storage {
  constructor(data = {}) { this.data = new Map(Object.entries(data)); }
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k,v) { this.data.set(k,String(v)); }
  removeItem(k) { this.data.delete(k); }
}
function client(initialUser = 'user1') {
  let row = null, n = 0, failAfterWrite = false, activeUser = initialUser;
  return {
    auth: { async getSession() { return { data: { session: activeUser ? { user: { id: activeUser } } : null }, error: null }; } },
    set currentUser(value) { activeUser = value; },
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
test('reports local changes while an unchanged cloud read is pending', async () => {
  const db = client('u'), local = new Storage({arcade_points:'10'});
  await upload(db,'u',local);
  const original = db.from;
  db.from = (...args) => { const query = original(...args); const first = query.maybeSingle; query.maybeSingle = async function() { const result = await first.call(this); local.setItem('arcade_points','11'); return result; }; return query; };
  assert.equal((await upload(db,'u',local)).localChanged,true);
});

test('rejects account changes during remote read without writing metadata', async () => {
  const db = client(), local = new Storage({arcade_points:'10'});
  await upload(db,'user1',local);
  local.removeItem(META_KEY);
  const original = db.from;
  db.from = (...args) => { const query = original(...args); const read = query.maybeSingle; query.maybeSingle = async function() { const result = await read.call(this); db.currentUser = 'user2'; return result; }; return query; };
  await assert.rejects(upload(db,'user1',local), /Account changed/);
  assert.equal(local.getItem(META_KEY), null);
});
test('account change after RPC does not bind the old account; retry recovers', async () => {
  const db = client(), local = new Storage({arcade_points:'10'}), rpc = db.rpc;
  db.rpc = async (...args) => { const result = await rpc(...args); db.currentUser = 'user2'; return result; };
  await assert.rejects(upload(db,'user1',local), /Account changed/);
  assert.equal(db.row.data.storage.arcade_points,'10');
  assert.equal(local.getItem(META_KEY),null);
  db.currentUser = 'user1'; db.rpc = rpc;
  assert.equal((await upload(db,'user1',local)).unchanged,true);
});
test('upload cannot overwrite a concurrently changed account binding', async () => {
  const db = client(), local = new Storage({arcade_points:'10'});
  const original = db.from;
  db.from = (...args) => { const query = original(...args); const read = query.maybeSingle; query.maybeSingle = async function() { const result = await read.call(this); local.setItem(META_KEY, JSON.stringify({user:'user2',revision:'r'})); return result; }; return query; };
  await assert.rejects(upload(db,'user1',local), /binding changed/);
  assert.equal(JSON.parse(local.getItem(META_KEY)).user,'user2');
  assert.equal(db.row,null);
});
test('active game blocks upload and restore, invalid revision cannot write', async () => {
  const remote = {revision:'r',data:{schema:1,storage:{arcade_points:'20'}}};
  const active = new Storage({arcade_active_session:'{}'});
  await assert.rejects(upload(client(),'user1',active), /game session is active/);
  assert.throws(() => restoreEmpty(active,'user1',remote), /game session is active/);
  const clean = new Storage();
  assert.throws(() => restoreEmpty(clean,'user1',{data:remote.data}), /Invalid cloud account or revision/);
  assert.equal(clean.length,0);
});
test('restore reports incomplete rollback without deleting unrelated data', () => {
  const local = new Storage({other:'stay'}), set = local.setItem.bind(local);
  local.setItem = (k,v) => { if(k === 'arcade_profile') throw Error('quota'); set(k,v); };
  local.removeItem = () => { throw Error('storage unavailable'); };
  assert.throws(() => restoreEmpty(local,'user1',{revision:'r',data:{schema:1,storage:{arcade_points:'20',arcade_profile:'{}'}}}), /rollback was incomplete/);
  assert.equal(local.getItem('other'),'stay');
  assert.equal(local.getItem('arcade_points'),'20');
});
test('a game starting during upload is reported as a local change', async () => {
  const db = client(), local = new Storage({arcade_points:'10'}), rpc = db.rpc;
  db.rpc = async (...args) => { const result = await rpc(...args); local.setItem('arcade_active_session','{}'); return result; };
  assert.equal((await upload(db,'user1',local)).localChanged,true);
});

test('restore preserves a concurrently changed account binding and rolls back its own keys', () => {
  const local = new Storage(), set = local.setItem.bind(local);
  local.setItem = (key, value) => { set(key,value); if (key === 'arcade_points') set(META_KEY, JSON.stringify({user:'user2',revision:'r2'})); };
  assert.throws(() => restoreEmpty(local,'user1',{revision:'r1',data:{schema:1,storage:{arcade_points:'20',arcade_profile:'{}'}}}), /Local data changed/);
  assert.equal(local.getItem('arcade_points'),null);
  assert.equal(JSON.parse(local.getItem(META_KEY)).user,'user2');
});
test('restore detects a concurrent recognized key not present in the snapshot', () => {
  const local = new Storage(), set = local.setItem.bind(local);
  local.setItem = (key,value) => { set(key,value); if (key === 'arcade_points') set('arcade_profile','new-local'); };
  assert.throws(() => restoreEmpty(local,'user1',{revision:'r1',data:{schema:1,storage:{arcade_points:'20'}}}), /Local data changed/);
  assert.equal(local.getItem('arcade_points'),null);
  assert.equal(local.getItem('arcade_profile'),'new-local');
});

test('accepts a one-row RPC array response', async () => {
  const db = client(), local = new Storage({arcade_points:'10'}), rpc = db.rpc;
  db.rpc = async (...args) => { const result = await rpc(...args); return { data: [result.data], error: result.error }; };
  await upload(db,'user1',local);
  assert.equal(JSON.parse(local.getItem(META_KEY)).revision,db.row.revision);
});


test('explicit replacement switches accounts and keeps non-game and auth data', () => {
  const oldBinding = JSON.stringify({user:'old',revision:'old-rev',project:'old-project'});
  const local = new Storage({arcade_points:'100', arcade_profile:'old', '2048_achievements_v1':'old', [META_KEY]:oldBinding, 'sb-project-auth-token':'secret', other:'untouched'});
  const before = captureLocal(local);
  const remote = {revision:'new-rev',data:{schema:1,storage:{arcade_points:'20',arcade_achievements:'new'}}};
  replaceLocal(local,'new-user',remote,before);
  assert.deepEqual({...collect(local).storage}, remote.data.storage);
  assert.equal(JSON.parse(local.getItem(META_KEY)).user,'new-user');
  assert.equal(local.getItem('sb-project-auth-token'),'secret'); assert.equal(local.getItem('other'),'untouched');
});
test('replacement refuses invalid, empty, active or changed local state before modifying data', () => {
  const local = new Storage({arcade_points:'100', other:'stay'}), before = captureLocal(local);
  const remote = {revision:'r',data:{schema:1,storage:{arcade_points:'20'}}};
  assert.throws(() => replaceLocal(local,'u',{revision:'r',data:{schema:1,storage:{}}},before), /empty/);
  assert.throws(() => replaceLocal(local,'u',{revision:'r',data:{schema:1,storage:{other:'x'}}},before), /Invalid snapshot/);
  local.setItem('arcade_active_session','active');
  assert.throws(() => replaceLocal(local,'u',remote,before), /game session is active/);
  local.removeItem('arcade_active_session'); local.setItem('arcade_points','101');
  assert.throws(() => replaceLocal(local,'u',remote,before), /Local data changed/);
  assert.equal(local.getItem('arcade_points'),'101'); assert.equal(local.getItem('other'),'stay');
});
test('replacement rolls back deletions and writes on a storage failure', () => {
  const local = new Storage({arcade_profile:'old-profile',arcade_points:'old-points', [META_KEY]:'old-binding',other:'stay'});
  const before = captureLocal(local), set = local.setItem.bind(local);
  local.setItem = (key,value) => { if (key === 'arcade_achievements') throw Error('quota'); set(key,value); };
  assert.throws(() => replaceLocal(local,'u',{revision:'r',data:{schema:1,storage:{arcade_points:'new',arcade_achievements:'new'}}},before), /quota/);
  assert.equal(local.getItem('arcade_profile'),'old-profile'); assert.equal(local.getItem('arcade_points'),'old-points');
  assert.equal(local.getItem(META_KEY),'old-binding'); assert.equal(local.getItem('other'),'stay');
});
test('replacement does not overwrite concurrent edits and warns if rollback cannot complete', () => {
  const local = new Storage({arcade_points:'old'}), before = captureLocal(local), set = local.setItem.bind(local);
  local.setItem = (key,value) => { set(key,value); if (key === 'arcade_points' && value === 'new') set(key,'concurrent'); };
  assert.throws(() => replaceLocal(local,'u',{revision:'r',data:{schema:1,storage:{arcade_points:'new'}}},before), /rollback was incomplete/);
  assert.equal(local.getItem('arcade_points'),'concurrent');
});
