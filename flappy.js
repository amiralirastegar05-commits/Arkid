import {createGame,DIFFICULTIES,WORLD} from './flappy-engine.js';

const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const toFa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORE='flappy_settings';
const SKINS={
  sunny:{label:'آفتابی',body:'#f8bd57',line:'#cf8445',belly:'#ffe6a2',tail:'#c76f39',beak:'#ec8b57'},
  sky:{label:'آسمانی',body:'#7ec8f2',line:'#4b91bd',belly:'#ddf3ff',tail:'#4f9bc9',beak:'#f5a85f'},
  rose:{label:'صورتی',body:'#f4a0ba',line:'#c56c8c',belly:'#ffe3ec',tail:'#cf6d8f',beak:'#f0a35d'},
  mint:{label:'نعنایی',body:'#93e3b7',line:'#52a97c',belly:'#e2fced',tail:'#5cb68a',beak:'#ffb347'}
};
const THEMES={
  day:{
    sky:['#4fb0ea','#9fe8e1','#ffe4b0'],sun:'#fff8d6',glow:'rgba(255,246,200,.45)',cloud:'rgba(255,255,255,.94)',cloudShade:'rgba(206,236,244,.9)',
    hills:['#9adcb8','#63c39d','#41a886'],rim:'rgba(255,255,255,.3)',bush:'#2f8d70',flowers:['#ffd66e','#ff9db6','#ffffff'],
    pipe:['#2a8d7c','#93eecd','#59d2b0','#1f7a6c'],pipeEdge:'#1b6b60',pipeLight:'rgba(255,255,255,.4)',
    ground:['#8ed477','#f3d6a4','#dfb98a'],stripe:'#d1a273',star:null
  },
  night:{
    sky:['#0a1533','#1f3767','#4a4a7d'],sun:'#fdf6d8',glow:'rgba(210,232,255,.22)',cloud:'rgba(219,234,255,.5)',cloudShade:'rgba(146,176,220,.3)',
    hills:['#23606b','#194551','#11303d'],rim:'rgba(126,240,215,.4)',bush:'#0e2a33',flowers:['#7ef0cd','#a7d4ff','#f6f0c8'],
    pipe:['#0f6156','#54e6c4','#28b89d','#0a4a3f'],pipeEdge:'#083f36',pipeLight:'rgba(190,255,241,.35)',
    ground:['#20604f','#1c4350','#153540'],stripe:'#2c6470',star:'#eaf6ff'
  }
};
const DEFAULTS={theme:'day',skin:'sunny',difficulty:'normal',sound:true,trail:true,motion:!reduced};
let settings=readSettings(),engine=createGame(Math.random,{difficulty:settings.difficulty});
let best=0,last=0,accumulator=0,lastScore=0,lastState='',flapAt=-9999,trail=[];
try{best=Math.max(0,parseInt(localStorage.getItem('arcade_top_flappy')||'0',10)||0)}catch(_){}
const stars=Array.from({length:44},(_,i)=>({x:(i*97+31)%360,y:(i*67+13)%330,r:.5+((i*29)%10)/11,tw:((i*37)%100)/100}));

function readSettings(){
  const value={...DEFAULTS};
  try{
    const saved=JSON.parse(localStorage.getItem(STORE)||'null')||{};
    if(saved.theme in THEMES)value.theme=saved.theme;
    if(saved.skin in SKINS)value.skin=saved.skin;
    if(saved.difficulty in DIFFICULTIES)value.difficulty=saved.difficulty;
    for(const key of ['sound','trail','motion'])if(typeof saved[key]==='boolean')value[key]=saved[key];
  }catch(_){}
  return value;
}
function saveSettings(){try{localStorage.setItem(STORE,JSON.stringify(settings))}catch(_){}}
function saveBest(){
  if(engine.game.score<=best)return;
  best=engine.game.score;
  try{best=Math.max(best,parseInt(localStorage.getItem('arcade_top_flappy')||'0',10)||0);localStorage.setItem('arcade_top_flappy',String(best))}catch(_){}
}
let audio=null;
function tone(freq,duration,type='sine',volume=.06,delay=0){
  if(!settings.sound)return;
  try{
    audio=audio||new (window.AudioContext||window.webkitAudioContext)();
    const start=audio.currentTime+delay,osc=audio.createOscillator(),gain=audio.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,start);osc.connect(gain);gain.connect(audio.destination);
    gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.start(start);osc.stop(start+duration);
  }catch(_){}
}
function applyTheme(){
  document.body.dataset.theme=settings.theme;
  $('themeColor').setAttribute('content',settings.theme==='night'?'#0b1220':'#111b35');
  $('stage').dataset.theme=settings.theme;
  for(const el of document.querySelectorAll('[data-theme-choice]')){const on=el.dataset.themeChoice===settings.theme;el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on))}
  for(const el of document.querySelectorAll('[data-skin-choice]')){const on=el.dataset.skinChoice===settings.skin;el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on))}
  for(const el of document.querySelectorAll('[data-difficulty]')){const on=el.dataset.difficulty===settings.difficulty;el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on))}
  $('soundToggle').setAttribute('aria-checked',String(settings.sound));
  $('motionToggle').setAttribute('aria-checked',String(settings.motion));
  $('trailToggle').setAttribute('aria-checked',String(settings.trail));
  $('soundToggle').classList.toggle('on',settings.sound);$('motionToggle').classList.toggle('on',settings.motion);$('trailToggle').classList.toggle('on',settings.trail);
}
function changeSettings(patch){
  const restart='difficulty' in patch&&patch.difficulty!==settings.difficulty;
  Object.assign(settings,patch);saveSettings();applyTheme();
  if(restart){engine=createGame(Math.random,{difficulty:settings.difficulty});accumulator=0;last=0;lastScore=0;trail=[];sync();tone(440,.08,'triangle',.04)}
  else{draw(performance.now())}
}
function sync(){
  const g=engine.game;
  $('score').textContent=toFa(g.score);$('best').textContent=toFa(best);
  $('readyMessage').hidden=g.state!=='ready';$('pauseMessage').hidden=g.state!=='paused';$('overMessage').hidden=g.state!=='gameover';
  $('pauseButton').disabled=!['playing','paused'].includes(g.state);$('pauseButton').textContent=g.state==='paused'?'▶':'Ⅱ';
  $('pauseButton').setAttribute('aria-label',g.state==='paused'?'ادامهٔ بازی':'توقف بازی');
  if(g.state!==lastState){
    if(g.state==='playing')$('status').textContent='پرواز شروع شد.';
    if(g.state==='paused')$('status').textContent='بازی متوقف شد.';
    if(g.state==='gameover'){
      saveBest();$('best').textContent=toFa(best);$('finalScore').textContent=toFa(g.score);
      $('status').textContent='پرواز تمام شد. امتیاز '+toFa(g.score);$('retryButton').focus({preventScroll:true});tone(180,.24,'sawtooth',.07);
    }
    lastState=g.state;
  }
  if(g.score!==lastScore){saveBest();$('best').textContent=toFa(best);lastScore=g.score;tone(900,.09,'sine',.05);tone(1220,.1,'sine',.04,.07)}
}
function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function cloud(x,y,s,t){
  ctx.save();ctx.translate(x,y);ctx.scale(s,s);
  ctx.fillStyle=t.cloudShade;ctx.beginPath();ctx.ellipse(0,10,38,12,0,0,Math.PI*2);ctx.ellipse(-17,3,18,14,0,0,Math.PI*2);ctx.ellipse(6,-4,24,19,0,0,Math.PI*2);ctx.ellipse(27,5,16,11,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.cloud;ctx.beginPath();ctx.ellipse(0,5,34,11,0,0,Math.PI*2);ctx.ellipse(-16,-2,17,13,0,0,Math.PI*2);ctx.ellipse(6,-8,22,17,0,0,Math.PI*2);ctx.ellipse(26,0,14,10,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function pipe(x,center,t){
  const gap=engine.game.world.gap,top=center-gap/2,bottom=center+gap/2,w=engine.game.world.pipeWidth;
  const grad=ctx.createLinearGradient(x,0,x+w,0);
  grad.addColorStop(0,t.pipe[0]);grad.addColorStop(.28,t.pipe[1]);grad.addColorStop(.72,t.pipe[2]);grad.addColorStop(1,t.pipe[3]);
  if(settings.theme==='night'){ctx.save();ctx.shadowColor='rgba(84,230,196,.45)';ctx.shadowBlur=16}
  ctx.fillStyle=grad;ctx.fillRect(x,0,w,top);ctx.fillRect(x,bottom,w,WORLD.ground-bottom);
  if(settings.theme==='night')ctx.restore();
  ctx.strokeStyle=t.pipeEdge;ctx.lineWidth=2;ctx.strokeRect(x+1,0,w-2,top);ctx.strokeRect(x+1,bottom,w-2,WORLD.ground-bottom);
  round(x-6,top-23,w+12,23,6,t.pipe[3]);round(x-5,top-22,w+10,17,4,grad);
  round(x-6,bottom,w+12,23,6,t.pipe[3]);round(x-5,bottom+2,w+10,17,4,grad);
  ctx.fillStyle=t.pipeLight;ctx.fillRect(x+9,0,5,Math.max(0,top-24));ctx.fillRect(x+9,bottom+24,5,WORLD.ground-bottom-24);
  ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(x+w-14,0,4,Math.max(0,top-24));ctx.fillRect(x+w-14,bottom+24,4,WORLD.ground-bottom-24);
}
function bird(x,y,velocity,now){
  const skin=SKINS[settings.skin]||SKINS.sunny;const since=now-flapAt;
  const wing=Math.sin(since/52)*.85*Math.exp(-since/420)+.15;
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.max(-.3,Math.min(.6,velocity/760)));
  ctx.fillStyle=skin.tail;ctx.beginPath();ctx.moveTo(-11,-4);ctx.lineTo(-26,-11);ctx.lineTo(-23,3);ctx.lineTo(-12,7);ctx.closePath();ctx.fill();
  ctx.fillStyle=skin.tail;ctx.beginPath();ctx.ellipse(-10,8,10,10,0,0,Math.PI*2);ctx.fill();
  const body=ctx.createRadialGradient(-4,-4,3,0,0,19);body.addColorStop(0,'#fff7db');body.addColorStop(.35,skin.body);body.addColorStop(1,skin.body);
  ctx.fillStyle=body;ctx.beginPath();ctx.ellipse(0,0,17,14.5,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=skin.line;ctx.lineWidth=1.8;ctx.stroke();
  ctx.fillStyle=skin.belly;ctx.beginPath();ctx.ellipse(-6,5,9.5,6.5,-.35,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.translate(-2,2);ctx.rotate(wing);ctx.fillStyle=skin.line;ctx.globalAlpha=.9;ctx.beginPath();ctx.ellipse(0,5,10,5.5,.25,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.fillStyle='#fffdf4';ctx.beginPath();ctx.arc(7.5,-5.5,6.8,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#27344a';ctx.beginPath();ctx.arc(9.5,-5.5,2.7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(10.6,-6.7,.9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(236,139,87,.35)';ctx.beginPath();ctx.ellipse(2,3.5,4,2.4,.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=skin.beak;ctx.beginPath();ctx.moveTo(13.5,-.5);ctx.lineTo(25,4);ctx.lineTo(13.5,8.5);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(160,86,45,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(15,4.2);ctx.lineTo(23,4);ctx.stroke();
  ctx.restore();
}
function draw(now=0){
  const g=engine.game,time=now/1000,t=THEMES[settings.theme],drift=settings.motion?(g.distance*.09)%520:0;
  const sky=ctx.createLinearGradient(0,0,0,WORLD.ground);sky.addColorStop(0,t.sky[0]);sky.addColorStop(.6,t.sky[1]);sky.addColorStop(1,t.sky[2]);
  ctx.fillStyle=sky;ctx.fillRect(0,0,WORLD.width,WORLD.height);
  if(t.star){for(const s of stars){const a=.4+.6*Math.abs(Math.sin(time*(.6+s.tw)+(settings.motion?1:0)));ctx.globalAlpha=settings.motion?a:.7;ctx.fillStyle=t.star;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1}
  const sunX=286,sunY=95;
  if(settings.motion&&settings.theme==='day'){
    ctx.save();ctx.translate(sunX,sunY);ctx.rotate(time*.08);ctx.fillStyle='rgba(255,243,187,.14)';
    for(let i=0;i<9;i++){ctx.rotate(Math.PI*2/9);ctx.beginPath();ctx.moveTo(-7,-38);ctx.lineTo(7,-38);ctx.lineTo(0,-82);ctx.closePath();ctx.fill()}
    ctx.restore();
  }
  const glow=ctx.createRadialGradient(sunX,sunY,10,sunX,sunY,90);
  glow.addColorStop(0,t.glow);glow.addColorStop(1,'rgba(255,246,200,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(sunX,sunY,90,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=t.sun;ctx.beginPath();ctx.arc(sunX,sunY,36,0,Math.PI*2);ctx.fill();
  if(settings.theme==='night'){ctx.fillStyle='rgba(200,215,240,.35)';for(const [cx,cy,r] of [[sunX-12,sunY-8,6],[sunX+9,sunY+6,4],[sunX-2,sunY+16,3]]){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill()}}
  cloud(46-drift,102,.62,t);cloud(246-drift*.85,182,.5,t);cloud(438-drift,88,.82,t);
  ctx.fillStyle=t.hills[0];ctx.beginPath();ctx.moveTo(0,478);ctx.quadraticCurveTo(58,392,132,470);ctx.quadraticCurveTo(212,386,288,461);ctx.quadraticCurveTo(342,418,360,453);ctx.lineTo(360,552);ctx.lineTo(0,552);ctx.fill();
  ctx.fillStyle=t.hills[1];ctx.beginPath();ctx.moveTo(0,507);ctx.quadraticCurveTo(66,445,146,508);ctx.quadraticCurveTo(232,430,312,501);ctx.quadraticCurveTo(344,478,360,488);ctx.lineTo(360,552);ctx.lineTo(0,552);ctx.fill();
  ctx.fillStyle=t.hills[2];ctx.beginPath();ctx.moveTo(0,532);ctx.quadraticCurveTo(74,492,154,530);ctx.quadraticCurveTo(240,486,326,528);ctx.quadraticCurveTo(348,516,360,522);ctx.lineTo(360,552);ctx.lineTo(0,552);ctx.fill();
  ctx.strokeStyle=t.rim;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(0,532);ctx.quadraticCurveTo(74,492,154,530);ctx.quadraticCurveTo(240,486,326,528);ctx.quadraticCurveTo(348,516,360,522);ctx.stroke();
  for(let i=0;i<6;i++){
    const bx=(i*81+24)%360,by=[534,528,538,531,536,529][i];
    ctx.fillStyle=t.bush;
    ctx.beginPath();ctx.ellipse(bx-9,by+3,11,8,0,0,Math.PI*2);ctx.ellipse(bx+9,by+3,11,8,0,0,Math.PI*2);ctx.ellipse(bx,by-3,14,11,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=t.rim;ctx.globalAlpha=.5;ctx.beginPath();ctx.ellipse(bx-3,by-7,7,4,-.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
  for(let i=0;i<9;i++){
    const fx=16+i*41,fy=543-(i%2)*5,color=t.flowers[i%3];
    ctx.fillStyle=color;for(let k=0;k<5;k++){const a=k*Math.PI*2/5;ctx.beginPath();ctx.arc(fx+Math.cos(a)*2.6,fy+Math.sin(a)*2.6,1.7,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle=t.flowers[0]===color?t.flowers[1]:t.flowers[0];ctx.beginPath();ctx.arc(fx,fy,1.3,0,Math.PI*2);ctx.fill();
  }
  for(const p of g.pipes)pipe(p.x,p.center,t);
  ctx.fillStyle=t.ground[0];ctx.fillRect(0,WORLD.ground-2,360,13);ctx.fillStyle=t.ground[1];ctx.fillRect(0,WORLD.ground+11,360,37);
  ctx.fillStyle=t.ground[2];ctx.fillRect(0,WORLD.ground+40,360,8);
  const offset=settings.motion?(g.distance*.4)%32:0;
  ctx.fillStyle=t.stripe;for(let x=-32;x<390;x+=32)ctx.fillRect(x-offset,579,18,3);
  ctx.fillStyle=t.stripe;for(let x=6;x<370;x+=27){ctx.fillRect(x-offset,556,2,5);ctx.fillRect(x-offset+4,558,2,4)}
  if(settings.trail&&g.state==='playing'){for(let i=0;i<trail.length;i++){const p=trail[i],a=(i+1)/trail.length*.3;ctx.fillStyle=`rgba(255,255,255,${a})`;ctx.beginPath();ctx.arc(p.x,p.y,10-i*.6,0,Math.PI*2);ctx.fill()}}
  bird(WORLD.birdX,g.y,g.velocity,now);
}
function frame(time){
  if(!last)last=time;const elapsed=Math.min((time-last)/1000,.05);last=time;
  if(engine.game.state==='playing'){
    accumulator+=elapsed;while(accumulator>=WORLD.step&&engine.game.state==='playing'){engine.update(WORLD.step);accumulator-=WORLD.step}
    if(settings.trail){trail.push({x:WORLD.birdX-14,y:engine.game.y});if(trail.length>7)trail.shift()}
  }else{accumulator=0;trail=[]}
  sync();draw(time);requestAnimationFrame(frame);
}
function fly(){
  if(engine.game.state==='ready'||engine.game.state==='playing'){
    if(engine.flap()){flapAt=performance.now();tone(520,.07,'triangle',.05);tone(660,.06,'triangle',.03,.05);sync()}
  }
}
function togglePause(){
  if(engine.game.state==='playing'){engine.pause();accumulator=0;sync()}
  else if(engine.game.state==='paused'){engine.resume();last=0;sync()}
}
function openSettings(){
  if($('settingsDialog').open){$('settingsButton').setAttribute('aria-expanded','true');return}
  if(engine.game.state==='playing'){engine.pause();accumulator=0;sync()}
  $('settingsDialog').showModal();$('settingsButton').setAttribute('aria-expanded','true');
}
function closeSettings(){$('settingsDialog').close();$('settingsButton').setAttribute('aria-expanded','false')}

$('startButton').addEventListener('click',fly);
$('readyMessage').addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||e.target.closest('button'))return;e.preventDefault();fly()});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();fly()});
$('pauseButton').addEventListener('click',togglePause);$('resumeButton').addEventListener('click',togglePause);
$('retryButton').addEventListener('click',()=>{engine.reset();last=0;lastScore=0;trail=[];sync();fly()});
$('settingsButton').addEventListener('click',openSettings);
$('settingsLink').addEventListener('click',openSettings);
$('closeSettings').addEventListener('click',closeSettings);
$('settingsDialog').addEventListener('close',()=>$('settingsButton').setAttribute('aria-expanded','false'));
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>{
  const name=tab.dataset.tab;
  for(const other of document.querySelectorAll('[data-tab]')){const on=other===tab;other.setAttribute('aria-selected',String(on));other.classList.toggle('on',on)}
  $('panelGeneral').hidden=name!=='general';$('panelLook').hidden=name!=='look';
});
for(const el of document.querySelectorAll('[data-theme-choice]'))el.addEventListener('click',()=>changeSettings({theme:el.dataset.themeChoice}));
for(const el of document.querySelectorAll('[data-skin-choice]'))el.addEventListener('click',()=>changeSettings({skin:el.dataset.skinChoice}));
for(const el of document.querySelectorAll('[data-difficulty]'))el.addEventListener('click',()=>changeSettings({difficulty:el.dataset.difficulty}));
$('soundToggle').addEventListener('click',()=>{changeSettings({sound:!settings.sound});if(settings.sound)tone(720,.08,'sine',.05)});
$('motionToggle').addEventListener('click',()=>changeSettings({motion:!settings.motion}));
$('trailToggle').addEventListener('click',()=>changeSettings({trail:!settings.trail}));
window.addEventListener('keydown',e=>{
  if($('settingsDialog').open)return;
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.target instanceof Element&&e.target.closest('button,a,input,select,textarea'))return;
  if([' ','ArrowUp','w','W'].includes(e.key)){if(['ready','playing'].includes(engine.game.state)){e.preventDefault();fly()}}
  else if(['p','P','Escape'].includes(e.key)){if(['playing','paused'].includes(engine.game.state)){e.preventDefault();togglePause()}}
});
function pauseOnLeave(){if(engine.game.state==='playing'){engine.pause();accumulator=0;sync()}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseOnLeave();else last=0});
window.addEventListener('blur',pauseOnLeave);
applyTheme();sync();draw(performance.now());requestAnimationFrame(frame);
