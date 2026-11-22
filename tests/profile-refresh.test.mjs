import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../arkid-refresh.css',import.meta.url),'utf8');
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));

test('pumpkin unlock no longer depends on date and preserves existing secret unlocks',()=>{
  const pumpkin=between('{ id: "pumpkin"','svg: `<svg');
  assert.match(pumpkin,/condition: \(\) => true/);
  const state={arcade_secret_unlocks:{cat:123,pumpkin:999}}; let notices=0;
  const context={LS:{get:(key,fallback)=>state[key]??fallback,set:(key,value)=>{state[key]=value}},SECRET_AVATARS:[{id:'cat',condition:()=>false},{id:'pumpkin',name:'کدو تنبل',condition:()=>true}],ALL_AVATARS:[],AVATARS:[],Date,Number,Array,document:{getElementById:()=>({classList:{contains:()=>false}})},showToast:()=>notices++};
  vm.createContext(context);vm.runInContext(between('function getSecretUnlocks()', 'function renderAvatarPicker()'),context);
  assert.equal(context.checkSecretAvatars(),false);assert.equal(state.arcade_secret_unlocks.pumpkin,999);assert.equal(notices,0);
  delete state.arcade_secret_unlocks.pumpkin;assert.equal(context.checkSecretAvatars(),true);assert.equal(state.arcade_secret_unlocks.cat,123);assert.ok(state.arcade_secret_unlocks.pumpkin>0);assert.equal(context.checkSecretAvatars(),false);assert.equal(notices,1);
});

test('all game artworks exist, can fall back offline and are included in the new cache',async()=>{
 const map=between('const GAME_ART =','Object.keys(GAME_ART)');
 const files=[...map.matchAll(/'([a-z0-9-]+\.(?:webp|svg))'/g)].map(m=>m[1]);assert.equal(files.length,13);
 for(const file of files){await access(new URL('../assets/game-covers/'+file,import.meta.url));assert.ok(sw.includes('assets/game-covers/'+file));}
 assert.match(html,/ORIGINAL_COVERS\[image\.dataset\.cover\]/);assert.match(sw,/arcade-2026-11-v25/);
});

test('per-game accent is scoped to hero and guide without mutating purchased theme',()=>{
 const accent=between('function applyGameAccent(game)', '/* ============================================================');
 assert.match(accent,/hero\.style\.setProperty\('--game-accent'/);assert.doesNotMatch(accent,/arcade_theme|arcade_equipped|document\.documentElement/);
 assert.match(html,/applyGameAccent\(g\)/);assert.match(html,/getLast\(\)\[0\]/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/\.au-no-motion/);
});

test('profile and statistics keep existing controls and readable empty states',()=>{
 for(const id of ['profileAvatar','profileName','profileNameInput','changeAvatarBtn','profileXPBar','profileStatsBtn','profileAchievementsBtn','profileShareBtn','profileJoined','profilePlays','profileAwards','profilePoints'])assert.ok(html.includes(`id="${id}"`),id);
 const stats=between('function openStats(){','/* ============================================================');
 for(const key of ['getStats()','achievements()','playsPerGame','scoresPerGame','playsByDate','makeShareCard(null)','openAboutModal()'])assert.ok(stats.includes(key),key);
 assert.match(stats,/هنوز بازی‌ای انجام ندادی/);assert.match(stats,/هنوز رکوردی ثبت نشده/);
});

test('all standalone menus use their own artwork with the original inline art available on failure',async()=>{
  for(const name of ['2048','arcade-runner','asteroids','breakout','mushroom-killer','mushroom-platformer','pacman','pong','river-raid','snake','space-invaders','tetris']){
    const game=await readFile(new URL('../'+name+'.html',import.meta.url),'utf8');
    assert.match(game,/href="game-landing\.css"/);assert.match(game,/class="landing-cover-art"/);assert.match(game,/onerror="this\.remove\(\)"/);
    assert.match(game,/<div class="art-half">[\s\S]*?<svg/);
  }
  const runner=await readFile(new URL('../game-runner.html',import.meta.url),'utf8');assert.match(runner,/class="runner-cover"/);assert.match(sw,/'game-landing\.css'/);
});
