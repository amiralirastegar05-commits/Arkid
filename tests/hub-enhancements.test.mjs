import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { isGameKey } from '../cloud/snapshot.js';

const source = await readFile(new URL('../hub-enhancements.js', import.meta.url),'utf8');
const ctx = {}; vm.runInNewContext(source,ctx);
const api=ctx.ArkidHubEnhancements;
const storage=()=>{const map=new Map(); return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v))};};

test('backup age is local, project, revision and account bound, and not part of a snapshot',()=>{
  const s=storage(), t=1_800_000_000_000;
  assert.equal(api.backupState(s,'a',t),'unknown'); assert.equal(api.recordBackup(s,'a',t),false);
  s.setItem('arkid_cloud_snapshot_meta_v1',JSON.stringify({user:'a',project:'p',revision:'r'}));
  assert.equal(api.recordBackup(s,'a',t),true); assert.equal(api.backupState(s,'a',t+1),'recent');
  assert.equal(api.backupState(s,'a',t+7*86400000),'old'); assert.equal(api.backupState(s,'b',t+1),'unknown');
  s.setItem('arkid_cloud_snapshot_meta_v1',JSON.stringify({user:'a',project:'p',revision:'new'}));
  assert.equal(api.backupState(s,'a',t+1),'unknown');
  s.setItem('arkid_cloud_snapshot_meta_v1','bad json'); assert.equal(api.backupState(s,'a',t+1),'unknown');
  assert.equal(isGameKey(api.BACKUP_KEY),false); assert.equal(isGameKey('arkid_backup_snooze_v1'),false);
  assert.equal(api.recordBackup({getItem(){throw Error('blocked')}},'a',t),false);
});

test('achievement thresholds match unlock rules and discovered game counts',()=>{
  const st={totalPlays:9,totalScore:50000,playsToday:3,dailyStreak:6,playsPerGame:{a:1,other:1},scoresPerGame:{a:1000,b:1001,c:2000,d:2001},playTimestamps:[700000,700001,999999]};
  const games=[{id:'a',available:true},{id:'b',available:true},{id:'c',available:false}], u={'first-step':1};
  const p=id=>api.achievementProgress(id,st,games,u,true,1000001);
  assert.equal(p('king').goal,50001); assert.equal(p('king').value,50000);
  assert.equal(p('diamond').goal,100001); assert.equal(p('stargazer').value,3); assert.equal(p('sharpshooter').value,2);
  assert.equal(p('explorer').value,1); assert.equal(p('explorer').goal,2); assert.equal(p('collector').value,1); assert.equal(p('collector').goal,1);
  assert.equal(p('whirlwind').value,2); assert.equal(p('halfway').goal,8); assert.equal(p('legend').goal,14);
  assert.ok(api.achievementProgress('explorer',st,games,u,false,0).hint); assert.ok(p('nightowl').hint);
});

test('all hub games have a guide, and only an explicit launch performs navigation and tracking',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const games=html.slice(html.indexOf('const GAMES = ['),html.indexOf('/* ---- کاورها'));
  const ids=[...games.matchAll(/\bid:'([^']+)'/g)].map(m=>m[1]);
  assert.equal(ids.length,13); for(const id of ids) assert.equal(api.guides[id]?.length,2,id);
  const guide=html.slice(html.indexOf('function launch(g, forceGotd'),html.indexOf('async function launchConfirmed'));
  assert.doesNotMatch(guide,/trackLaunch|location\.href|arcade_plays/); assert.match(guide,/pending\.tournamentContext/);
  assert.match(html,/if \(id === 'gameGuideModal'\) pendingGameGuide = null/);
});

test('only complete manual uploads record a reminder timestamp',async()=>{
  const src=await readFile(new URL('../auth.js',import.meta.url),'utf8');
  const code=src.slice(src.indexOf('  async function uploadCloud()'),src.indexOf('  function openDialog()'));
  for(const scenario of ['ok','changed','volatileBefore','volatileAfter','failure','accountChanged','cancel']) {
    let records=0, calls=0, volatileCalls=0;
    const session={user:{id:'a'}};
    const c={session,localStorage:{},setBusy(){},setStatus(){},updateBackupNotice(){},confirm:()=>scenario!=='cancel',
      window:{arkidHasVolatileData:()=>{volatileCalls++;return scenario==='volatileBefore'||(scenario==='volatileAfter'&&volatileCalls>1)},ArkidMessages:{message:()=>''},ArkidHubEnhancements:{recordBackup:()=>records++}},
      auth:{getClient(){},snapshots:{async upload(){calls++;if(scenario==='failure')throw Error();if(scenario==='accountChanged') c.session={user:{id:'b'}};return {localChanged:scenario==='changed'};}}}};
    vm.runInNewContext(code+'\nglobalThis.run=uploadCloud',c); await c.run();
    assert.equal(records,scenario==='ok'?1:0,scenario); assert.equal(calls,['cancel','volatileBefore'].includes(scenario)?0:1,scenario);
  }
});
