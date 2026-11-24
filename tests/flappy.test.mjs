import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGame,DIFFICULTIES,WORLD} from '../flappy-engine.js';
import {isGameKey} from '../cloud/snapshot.js';

test('the bird responds to input, falls under gravity, pauses and resets',()=>{
 const e=createGame(()=>.5);const {game}=e;const initial=game.y;e.update(.05);assert.equal(game.y,initial);assert.equal(game.state,'ready');
 assert.equal(e.flap(),true);e.update(.05);assert.ok(game.y<initial);assert.ok(game.velocity>WORLD.flap);
 assert.equal(e.pause(),true);const y=game.y,x=game.pipes[0].x;e.update(.05);assert.equal(game.y,y);assert.equal(game.pipes[0].x,x);assert.equal(e.flap(),false);
 assert.equal(e.resume(),true);e.update(.05);assert.notEqual(game.y,y);e.reset();assert.equal(game.state,'ready');assert.equal(game.score,0);assert.equal(game.pipes.length,1);
});

test('drawn pipe bounds and ground are solid, while the open gap is traversable',()=>{
 const safe=createGame(()=>.5);safe.flap();safe.game.pipes=[{x:WORLD.birdX,center:280,passed:false}];safe.game.y=280;safe.game.velocity=0;safe.update(WORLD.step);assert.equal(safe.game.state,'playing');
 for(const y of [280-WORLD.gap/2+WORLD.birdRadius-1,280+WORLD.gap/2-WORLD.birdRadius+1]){const e=createGame();e.flap();e.game.pipes=[{x:WORLD.birdX,center:280,passed:false}];e.game.y=y;e.game.velocity=0;e.update(WORLD.step);assert.equal(e.game.state,'gameover');assert.equal(e.flap(),false)}
 const floor=createGame();floor.flap();floor.game.y=WORLD.ground-WORLD.birdRadius-1;floor.game.velocity=100;floor.update(.05);assert.equal(floor.game.state,'gameover');
 const ceiling=createGame();ceiling.flap();ceiling.game.y=WORLD.birdRadius+1;ceiling.update(.05);assert.equal(ceiling.game.state,'gameover');
});

test('each cleared obstacle scores once, and new gaps stay within safe bounds',()=>{
 const e=createGame(()=>1);e.flap();e.game.y=280;e.game.velocity=0;e.game.pipes=[{x:WORLD.birdX-WORLD.birdRadius-WORLD.pipeWidth+1,center:280,passed:false}];e.update(.02);assert.equal(e.game.score,1);e.update(.02);assert.equal(e.game.score,1);assert.ok(e.game.pipes.every(p=>p.center>=170&&p.center<=375));
});

test('difficulty presets change the real obstacle gap, speed and spawn spacing',()=>{
 const easy=createGame(()=>.5,{difficulty:'easy'}),normal=createGame(()=>.5,{difficulty:'normal'}),hard=createGame(()=>.5,{difficulty:'hard'});
 assert.equal(easy.game.world.gap,DIFFICULTIES.easy.gap);assert.equal(hard.game.world.gap,DIFFICULTIES.hard.gap);assert.ok(easy.game.world.gap>normal.game.world.gap&&normal.game.world.gap>hard.game.world.gap);
 assert.ok(hard.game.world.speed>normal.game.world.speed);assert.equal(createGame(()=>.5,{difficulty:'unknown'}).game.world.gap,WORLD.gap);
 const tight=createGame(()=>.5,{difficulty:'hard'});tight.flap();tight.game.pipes=[{x:WORLD.birdX,center:280,passed:false}];tight.game.y=280-DIFFICULTIES.hard.gap/2+WORLD.birdRadius-2;tight.game.velocity=0;tight.update(WORLD.step);
 assert.equal(tight.game.state,'gameover');
 const roomy=createGame(()=>.5,{difficulty:'easy'});roomy.flap();roomy.game.pipes=[{x:WORLD.birdX,center:280,passed:false}];roomy.game.y=280-DIFFICULTIES.hard.gap/2+WORLD.birdRadius-2;roomy.game.velocity=0;roomy.update(WORLD.step);
 assert.equal(roomy.game.state,'playing');
});

test('settings and personalization panel drives real theme, skin, sound and trail options',async()=>{
 const html=await readFile(new URL('../flappy.html',import.meta.url),'utf8'),game=await readFile(new URL('../flappy.js',import.meta.url),'utf8'),css=await readFile(new URL('../flappy.css',import.meta.url),'utf8');
 for(const id of ['settingsButton','settingsDialog','soundToggle','motionToggle','trailToggle','closeSettings'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/data-tab="general"[^>]*>تنظیمات/);assert.match(html,/data-tab="look"[^>]*>شخصی‌سازی/);
 for(const value of ['day','night'])assert.ok(html.includes(`data-theme-choice="${value}"`));
 for(const value of ['sunny','sky','rose','mint'])assert.ok(html.includes(`data-skin-choice="${value}"`));
 for(const value of ['easy','normal','hard'])assert.ok(html.includes(`data-difficulty="${value}"`));
 assert.match(game,/localStorage\.setItem\(STORE,JSON\.stringify\(settings\)\)/);assert.match(game,/flappy_settings|STORE='flappy_settings'/);
 assert.match(game,/createGame\(Math\.random,\{difficulty:settings\.difficulty\}\)/);assert.match(game,/settings\.theme==='night'/);
 assert.match(game,/settings\.skin/);assert.match(game,/settings\.sound/);assert.match(game,/settings\.trail/);assert.match(game,/AudioContext/);
 assert.match(css,/\.sheet\{/);assert.match(css,/\.skins/);
});

test('game integrates with hub, guide, score backup and complete offline cache',async()=>{
 const hub=await readFile(new URL('../index.html',import.meta.url),'utf8'),sw=await readFile(new URL('../sw.js',import.meta.url),'utf8'),guides=await readFile(new URL('../hub-enhancements.js',import.meta.url),'utf8'),game=await readFile(new URL('../flappy.js',import.meta.url),'utf8');
 assert.match(hub,/id:'flappy'.*file:'flappy\.html'.*cover:'bird'/);assert.match(guides,/'flappy':/);assert.equal(isGameKey('arcade_top_flappy'),true);
 for(const asset of ['flappy.html','flappy.css','flappy.js','flappy-engine.js','assets/game-covers/flappy.svg'])assert.ok(sw.includes(`'${asset}'`),asset);
 assert.match(game,/localStorage\.setItem\('arcade_top_flappy'/);assert.match(game,/visibilitychange/);assert.match(game,/pointerdown/);assert.match(game,/e\.repeat/);assert.match(game,/settingsButton/);
});
