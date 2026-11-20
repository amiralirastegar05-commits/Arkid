import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as snapshots from '../cloud/snapshot.js';

const code = (await readFile(new URL('../cloud/restore.js', import.meta.url), 'utf8'))
  .replace("import '../cloud/messages.js';", '')
  .replace("  await import('./arcade-auth.js');", '');
class Storage {
  constructor(initial) { this.map = new Map(Object.entries(initial)); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(key) { return this.map.get(key) ?? null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
async function setup({ remote = {revision:'r2',data:{schema:1,storage:{arcade_points:'50'}}}, approve = true, onConfirm = () => {} } = {}) {
  const elements = Object.fromEntries(['status','login','account','restore','download','replace','downloadLocal','signout','openGame','accountEmail'].map(id => [id, {
    hidden:false, dataset:{}, textContent:'', handlers:{},
    addEventListener(event, fn) { this.handlers[event] = fn; },
    querySelectorAll() { return []; }, reset() {}
  }]));
  const localStorage = new Storage({arcade_points:'10', 'sb-project-auth-token':'token', other:'stay'});
  let activeUser = 'user2', currentRemote = remote, prompts = [];
  const client = {
    auth:{async getSession() { return {data:{session:{user:{id:activeUser, email:'second@example.com'}}},error:null}; }},
    from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return {data:currentRemote,error:null}; } }; }
  };
  const auth = {snapshots, getSession:()=>client.auth.getSession(), getClient:()=>client};
  const context = {document:{getElementById:id=>elements[id]}, window:{ArkidAuth:auth}, localStorage, TextEncoder, confirm: msg => { prompts.push(msg); onConfirm({localStorage, changeUser:value=>{activeUser=value;}, changeRemote:value=>{currentRemote=value;}}); return approve; }, ArkidMessages:{message:error=>error.message}};
  context.globalThis = context;
  await vm.runInNewContext(`(async()=>{${code}\n})()`, context);
  return { elements, localStorage, prompts, changeUser:value=>{activeUser=value;}, changeRemote:value=>{currentRemote=value;} };
}
test('replacement UI cancels safely after identifying the account', async () => {
  const ctx = await setup({approve:false});
  await ctx.elements.replace.handlers.click();
  assert.match(ctx.prompts[0], /second@example.com/);
  assert.equal(ctx.localStorage.getItem('arcade_points'),'10');
  assert.equal(ctx.localStorage.getItem(snapshots.META_KEY),null);
  assert.match(ctx.elements.status.textContent,/لغو/);
});
test('replacement UI refuses absent backup before confirmation', async () => {
  const ctx = await setup({remote:null});
  await ctx.elements.replace.handlers.click();
  assert.equal(ctx.prompts.length,0);
  assert.equal(ctx.localStorage.getItem('arcade_points'),'10');
});
test('replacement UI installs cloud data while preserving session', async () => {
  const ctx = await setup();
  await ctx.elements.replace.handlers.click();
  assert.equal(ctx.localStorage.getItem('arcade_points'),'50');
  assert.equal(ctx.localStorage.getItem('sb-project-auth-token'),'token');
  assert.equal(ctx.localStorage.getItem('other'),'stay');
  assert.equal(JSON.parse(ctx.localStorage.getItem(snapshots.META_KEY)).user,'user2');
  assert.equal(ctx.elements.openGame.hidden,false);
});

test('replacement UI refuses a changed account, local state, or cloud revision', async () => {
  for (const onConfirm of [
    c => c.changeUser('other-user'),
    c => c.localStorage.setItem('arcade_points','11'),
    c => c.changeRemote({revision:'newer',data:{schema:1,storage:{arcade_points:'99'}}})
  ]) {
    const ctx = await setup({onConfirm});
    await ctx.elements.replace.handlers.click();
    assert.notEqual(ctx.localStorage.getItem('arcade_points'),'50');
    assert.equal(ctx.localStorage.getItem(snapshots.META_KEY),null);
    assert.equal(ctx.elements.status.dataset.kind,'error');
  }
});
