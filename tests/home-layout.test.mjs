import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../arcade-upgrade.css',import.meta.url),'utf8');
const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const section=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));

test('the game grid remains visible on home and other features are grouped in four initially closed native cards',()=>{
  const cards=section('<section class="home-collection"','<!-- ============ ادامه بده');
  assert.equal((cards.match(/<details class="home-card"/g)||[]).length,4);
  for(const id of ['homeToday','homeProgress','homeRewards','homeMore']) assert.match(cards,new RegExp(`<details class="home-card" id="${id}">\\s*<summary>`));
  const groups=[['homeToday','homeProgress',['gameOfDay','questsSection','weeklyBoss']],['homeProgress','homeRewards',['statGames','statPlays','statBest','achStrip']],['homeRewards','homeMore',['homePetSlot']],['homeMore','<!-- ============ ادامه بده',['heroMessengersBtn','startTournamentBtn','bannersSection']]];
  for(const [a,b,ids] of groups){const group=section(`id="${a}"`,b.startsWith('<!--')?b:`id="${b}"`);for(const id of ids) assert.match(group,new RegExp(`id="${id}"`));}
  const games=section('<section class="games"','</main>'); assert.match(games,/id="grid"/);assert.match(games,/id="searchInput"/);assert.match(games,/id="filters"/);
  for(const id of ['gameOfDay','questsSection','weeklyBoss','achStrip','heroMessengersBtn','startTournamentBtn','bannersSection','grid','heroRandomBtn']) assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,id);
});

test('opening one card closes the others and clicking the open card can close it',()=>{
  const calls=[]; const cards=Array.from({length:4},()=>{const summary={addEventListener:(type,fn)=>calls.push(fn)};return {open:false,querySelector:()=>summary}});
  const code=section("document.querySelectorAll('.home-card').forEach",'function updateConnectionNotice()');
  vm.runInNewContext(code,{document:{querySelectorAll:()=>cards}});
  calls[0](); cards[0].open=true; calls[1](); cards[1].open=true; assert.equal(cards[0].open,false); assert.equal(cards[1].open,true);
  calls[1](); assert.equal(cards[1].open,true); // the browser's native details action then closes it
});

test('pet, pinned games, action handlers and offline cache remain wired after rearranging',()=>{
  assert.match(html,/auEl\('homePetSlot'\)\.append\(pet\)/);
  assert.match(html,/auEl\('auPins'\)\.hidden=!list\.length/);
  assert.match(html,/getElementById\('homeProfileBtn'\)\.addEventListener\('click',openProfileModal\)/);
  assert.match(html,/getElementById\('homeStatsBtn'\)\.addEventListener\('click',openStats\)/);
  assert.match(css,/#homePetSlot \.au-pet\[hidden\]\{display:none\}/);
  assert.match(sw,/arcade-2026-11-v31/);
});

test('card motion is short, interaction-only, and honors both motion settings',()=>{
  assert.match(css,/\.home-card\[open\] > \.home-card-body\{animation:home-card-reveal \.22s ease-out both\}/);
  assert.match(css,/@keyframes home-card-reveal\{from\{opacity:0;transform:translateY\(-5px\)\}to\{opacity:1;transform:translateY\(0\)\}\}/);
  assert.match(css,/\.au-no-motion \.home-card\[open\] > \.home-card-body\{animation:none\}/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.home-card\[open\] > \.home-card-body\{animation:none\}/);
});
