import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const [html,sw]=await Promise.all(['../index.html','../sw.js'].map(file=>readFile(new URL(file,import.meta.url),'utf8')));

test('every bundled game is available without a network probe, so cards never fall back to soon',()=>{
 const entries=[...html.matchAll(/id:'([a-z0-9-]+)'[^}]*?available:(true|false)/g)].map(m=>[m[1],m[2]]);
 assert.equal(entries.length,15);
 assert.deepEqual(entries.filter(([,flag])=>flag!=='true'),[]);
 assert.doesNotMatch(html,/available:false/);
 for(const game of ['flappy','tictactoe','snake','pacman','game-runner','pong'])assert.ok(entries.some(([id])=>id===game),game);
});

test('availability checks only upgrade unknown games and never downgrade a shipped one',()=>{
 assert.match(html,/if \(!GAMES\.some\(game => !game\.available\)\) \{ filesChecked = true; return; \}/);
 assert.match(html,/const pending = GAMES\.filter\(game => !game\.available\)/);
 assert.match(html,/if \(existence\[index\] !== true\) return;/);
 assert.doesNotMatch(html,/game\.available = false/);
});

test('offline cache refreshes from the network first so a stale hub cannot persist',()=>{
 assert.match(sw,/arcade-2026-11-v31/);
 const handler=sw.slice(sw.indexOf("if(!(/\\.(html|css|js|woff2?|ttf|otf)\$/i.test(url.pathname)"));
 const network=handler.indexOf('fetch(request,{cache:\'no-store\'})');
 const cached=handler.indexOf('cache.match(key.href)');
 assert.ok(network>=0&&cached>network,'network is tried before the cached copy');
 assert.match(sw,/offlinePage\(\)/);
 assert.match(sw,/self\.skipWaiting\(\)/);
});

test('a newly activated worker reloads the hub once so new cards and covers appear',()=>{
 assert.match(html,/const hadController=!!navigator\.serviceWorker\.controller/);
 assert.match(html,/addEventListener\('controllerchange'/);
 assert.match(html,/arcade_sw_reloaded/);
 assert.match(html,/location\.reload\(\)/);
 assert.match(html,/const registerOffline=\(\)=>navigator\.serviceWorker\.register\('sw\.js'\)/);
 assert.match(html,/reg\.update\?\.\(\)/);
 assert.match(html,/coverFallback\(image\.dataset\.cover\)/);
 assert.match(html,/const GENERIC_COVER/);
});

test('webp covers ship a jpeg twin so an unsupported format still shows the artwork',async()=>{
 assert.match(html,/const GAME_ART_FALLBACK = \{/);
 assert.match(html,/data-fallback="assets\/game-covers\/\$\{fallback\}"/);
 assert.match(html,/if \(image\.dataset\.fallback && image\.dataset\.fallbackTried !== '1'\) \{ image\.dataset\.fallbackTried = '1'; image\.src = image\.dataset\.fallback; return; \}/);
 for(const name of ['2048','asteroids','breakout','mushroom-killer','mushroom-platformer','pong','river-raid','snake','space-invaders']){
   assert.ok(html.includes(`${name}.webp`)||html.includes(`${name}.jpg`),name);
   await access(new URL(`../assets/game-covers/${name}.jpg`,import.meta.url));
   assert.ok(sw.includes(`assets/game-covers/${name}.jpg`),name);
 }
});
