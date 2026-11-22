import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = name => readFileSync(new URL(`../${name}.html`, import.meta.url), 'utf8');

test('snake buffers two valid quick turns without accepting reversals', () => {
  const html = source('snake');
  const fn = html.slice(html.indexOf('  function queueDir(dx, dy)'), html.indexOf('\n  // D-pad', html.indexOf('  function queueDir(dx, dy)')));
  const g = { state: 'PLAYING', dir: {x:1,y:0}, pendingDir:null, nextPendingDir:null };
  const ctx = { G:g, Snd:{init(){},tick(){}} }; vm.createContext(ctx); vm.runInContext(fn,ctx);
  ctx.queueDir(-1,0); assert.equal(g.pendingDir,null);
  ctx.queueDir(0,-1); ctx.queueDir(-1,0); ctx.queueDir(0,1);
  assert.deepEqual(JSON.parse(JSON.stringify([g.pendingDir,g.nextPendingDir])),[{x:0,y:-1},{x:-1,y:0}]);
  assert.match(html,/wl\.pendingDir = wl\.nextPendingDir \|\| null/);
  assert.match(html,/wl\.nextPendingDir = null/);
});

test('pong tracks each finger independently and releases cancelled touches', () => {
  const html=source('pong');
  const block=html.slice(html.indexOf('  // Each finger owns its paddle'),html.indexOf('  /* ============================================================\n     ۲۵) Gamepad'));
  const listeners={}; const canvas={addEventListener:(n,f)=>{listeners[n]=f}};
  const input={touchL:null,touchR:null};const context={canvas,input,G:{state:'PLAYING',mode:'two',W:100},gameWrap:{hidden:false},touchPos:t=>({x:t.x,y:t.y}),window:{addEventListener(){}}};
  vm.createContext(context);vm.runInContext(block,context);
  const l={identifier:1,x:20,y:10},r={identifier:2,x:80,y:30};
  const ev=(touches,changedTouches)=>({touches,changedTouches,preventDefault(){}});
  listeners.touchstart(ev([l],[l]));listeners.touchstart(ev([l,r],[r]));assert.equal(input.touchL,10);assert.equal(input.touchR,30);
  const crossed={...r,x:10,y:40};listeners.touchmove(ev([l,crossed],[crossed]));assert.equal(input.touchL,10);assert.equal(input.touchR,40);
  listeners.touchend(ev([crossed],[l]));assert.equal(input.touchL,null);assert.equal(input.touchR,40);
  listeners.touchcancel(ev([],[crossed]));assert.equal(input.touchR,null);
  context.G.mode='single';listeners.touchstart(ev([r],[r]));assert.equal(input.touchL,30);
  assert.match(html,/if \(livesItem\.hidden\) livesItem\.hidden = false/);
});

test('runner has a fixed-step simulation, independent steering and persistent pauses', () => {
  const html=source('game-runner');
  assert.match(html,/id="runnerLeft"/);assert.match(html,/id="runnerRight"/);assert.match(html,/id="pauseRunnerBtn"/);
  assert.match(html,/pointerdown', e=>/);assert.match(html,/pointercancel/);assert.match(html,/lostpointercapture/);
  assert.match(html,/while\(accumulator >= 1\/60/);assert.match(html,/if\(document\.hidden && gameActive && !gamePaused\) pauseGame\(\)/);
  assert.match(html,/window\.addEventListener\('pagehide',\(\)=>\{if\(runStarted\) saveGame\(\);\}\)/);
  assert.match(html,/if \(!runStarted\) startGame\(\)/);
});

test('arcade runner finishes its intro without referencing a missing rotation variable', () => {
  const html=source('arcade-runner');
  assert.doesNotMatch(html,/\bAt&&gt\(!0\)/);assert.match(html,/_rotationPaused&&gt\(!0\)/);
});

test('2048 retains its swipe pointer until release without hijacking buttons', () => {
  const html=source('2048');
  assert.match(html,/ev\.target\.closest\('button'\)/);
  assert.match(html,/gameWrap\.setPointerCapture\(ev\.pointerId\)/);
  assert.match(html,/if \(!swipeStart \|\| swipeStart\.id !== ev\.pointerId\) return/);
});

test('tetris repeat and focus loss cannot cause unintended drops or stuck input', () => {
  const html=source('tetris');
  const start=html.indexOf("  window.addEventListener('keydown', function (ev) {",html.indexOf('  var keys = {};'));
  const end=html.indexOf('  var tbtns =',start);
  const handlers={}, calls={left:0,rotate:0,drop:0,hold:0};
  const ctx={window:{addEventListener:(type,fn)=>{handlers[type]=fn}},keys:{},touchState:{left:true,right:true,down:true},G:{state:'PLAYING',softDrop:true},gameWrap:{hidden:false},
    doLeft:()=>calls.left++,doRight(){},doRotate:()=>calls.rotate++,doHardDrop:()=>calls.drop++,doHold:()=>calls.hold++,muteBtn:{click(){}},
    settingsModal:{},scoresModal:{},achvModal:{},togglePause(){},restartBtn:{click(){}}};
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
  const down=(key,repeat=false)=>handlers.keydown({key,repeat,target:{tagName:'BODY'},preventDefault(){}});
  down(' ');down(' ',true);down('ArrowUp');down('ArrowUp',true);down('ArrowLeft');down('ArrowLeft',true);
  assert.deepEqual(calls,{left:2,rotate:1,drop:1,hold:0});
  handlers.blur();assert.equal(ctx.G.softDrop,false);assert.deepEqual(ctx.touchState,{left:false,right:false,down:false});
  down(' ');assert.equal(calls.drop,2);
});

test('pacman maze has connected pellets and only the centre tunnel wraps', () => {
  const html = source('pacman');
  const rows = [...html.slice(html.indexOf('const MAZE_STR'),html.indexOf('const MW =')).matchAll(/"([# .o-]+)"/g)].map(m=>m[1]);
  assert.equal(rows.length,31);assert.ok(rows.every(r=>r.length===28));
  const queue=[[13,23]], visited=new Set(['13,23']);
  for(let i=0;i<queue.length;i++) {
    const [x,y]=queue[i];
    for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      let nx=x+dx,ny=y+dy;
      if(nx<0 || nx>=28) { if(y!==14) continue; nx=(nx+28)%28; }
      if(ny<0 || ny>=31 || '#-'.includes(rows[ny][nx])) continue;
      const key=`${nx},${ny}`; if(!visited.has(key)){visited.add(key);queue.push([nx,ny]);}
    }
  }
  for(let y=0;y<31;y++) for(let x=0;x<28;x++) if('.o'.includes(rows[y][x])) assert.ok(visited.has(`${x},${y}`),`unreachable pellet ${x},${y}`);
});

test('pacman stops at walls, takes queued turns and never travels through the maze', () => {
  const html=source('pacman');
  const rows=[...html.slice(html.indexOf('const MAZE_STR'),html.indexOf('const MW =')).matchAll(/"([# .o-]+)"/g)].map(m=>m[1]);
  const start=html.indexOf('  function isWall(tx, ty, forGhost)');
  const end=html.indexOf('  /* ============================================================\n     EAT LOGIC',start);
  const world={maze:rows.map(r=>r.split('')),state:'PLAYING',level:1,TILE:13,fruit:null,pac:{tileX:1,tileY:1,progress:0,dir:{x:-1,y:0},nextDir:null,x:0,y:0,mouthAnim:0}};
  const ctx={world,MW:28,MH:31,eatAt(){},checkGhostCollisions(){},collectFruit(){},syncPacPos(){const p=world.pac;p.x=(p.tileX+.5+p.dir.x*p.progress)*world.TILE;p.y=(p.tileY+.5+p.dir.y*p.progress)*world.TILE;}};
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
  assert.equal(ctx.isWall(-1,1,false),true);assert.equal(ctx.isWall(-1,14,false),false);assert.equal(ctx.isWall(1,-1,false),true);
  ctx.updatePac(.1);assert.equal(world.pac.tileX,1);assert.equal(world.pac.progress,0);
  world.pac.nextDir={x:0,y:1};ctx.updatePac(.25);assert.equal(world.pac.tileY,2);
  let seed=123;const directions=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let i=0;i<4000;i++){
    seed=(seed*1664525+1013904223)>>>0;
    if(i%4===0){const [x,y]=directions[(seed >>> 24)%4];world.pac.nextDir={x,y};}
    ctx.updatePac(.04);const p=world.pac;
    assert.notEqual(rows[p.tileY][p.tileX],'#',`entered wall ${p.tileX},${p.tileY}`);
    if(p.progress>0) assert.equal(ctx.isWall(p.tileX+p.dir.x,p.tileY+p.dir.y,false),false,'travel toward wall');
  }
});

test('pacman renders entities in maze coordinates and times ghost release per life', () => {
  const html=source('pacman');
  const draw=html.slice(html.indexOf('  function drawPac(p)'),html.indexOf('  /* ============================================================\n     HUD',html.indexOf('  function drawPac(p)')));
  assert.doesNotMatch(draw,/world\.O[XY] \+ [pgf]\./);
  assert.match(draw,/ctx\.translate\(p\.x, p\.y\)/);
  assert.match(html,/g\.houseTimer >= g\.releaseAt/);
  assert.match(html,/Math\.abs\(dx\) > 0\.5/);
});

test('snake connects adjacent body segments but never draws across a wrap', () => {
  const html=source('snake');
  const start=html.indexOf('  function drawSnake(wl, c) {');
  const end=html.indexOf('  function drawFood(wl, c)',start);
  const lines=[]; const noOp=()=>{};
  const c=new Proxy({}, {get(target,prop){return target[prop] || noOp},set(target,prop,value){target[prop]=value;return true}});
  c.moveTo=(x,y)=>lines.push(['move',x,y]); c.lineTo=(x,y)=>lines.push(['line',x,y]);
  const ctx={Math,TAU:Math.PI*2,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t,roundRect:noOp};
  vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
  const snake=[{x:1,y:3},{x:0,y:3},{x:19,y:3}];
  ctx.drawSnake({cell:20,ox:0,oy:0,snake,prevSnake:snake,dead:false,moveAcc:0,moveTime:1,dir:{x:1,y:0}},c);
  assert.deepEqual(lines,[['move',30,70],['line',10,70]]);
});
