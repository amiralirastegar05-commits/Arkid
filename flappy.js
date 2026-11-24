import {createGame,WORLD} from './flappy-engine.js';
const $=id=>document.getElementById(id), canvas=$('game'),ctx=canvas.getContext('2d');
const {game,reset,flap,pause,resume,update}=createGame();
const toFa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
let best=0,last=0,accumulator=0,lastScore=0,lastState='';
try{best=Math.max(0,parseInt(localStorage.getItem('arcade_top_flappy')||'0',10)||0)}catch(_){}
function saveBest(){if(game.score<=best)return;best=game.score;try{const old=Math.max(0,parseInt(localStorage.getItem('arcade_top_flappy')||'0',10)||0);best=Math.max(old,best);localStorage.setItem('arcade_top_flappy',String(best))}catch(_){}}
function sync(){
  $('score').textContent=toFa(game.score);$('best').textContent=toFa(best);
  $('readyMessage').hidden=game.state!=='ready';$('pauseMessage').hidden=game.state!=='paused';$('overMessage').hidden=game.state!=='gameover';
  $('pauseButton').disabled=!['playing','paused'].includes(game.state);$('pauseButton').textContent=game.state==='paused'?'▶':'Ⅱ';$('pauseButton').setAttribute('aria-label',game.state==='paused'?'ادامهٔ بازی':'توقف بازی');
  if(game.state!==lastState){
    if(game.state==='playing')$('status').textContent='پرواز شروع شد.';
    if(game.state==='paused')$('status').textContent='بازی متوقف شد.';
    if(game.state==='gameover'){saveBest();$('best').textContent=toFa(best);$('finalScore').textContent=toFa(game.score);$('status').textContent='پرواز تمام شد. امتیاز '+toFa(game.score);$('retryButton').focus({preventScroll:true})}
    lastState=game.state;
  }
  if(game.score!==lastScore){saveBest();$('best').textContent=toFa(best);lastScore=game.score}
}
function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function cloud(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='rgba(255,255,255,.7)';ctx.beginPath();ctx.ellipse(0,8,38,13,0,0,Math.PI*2);ctx.ellipse(-17,1,18,16,0,0,Math.PI*2);ctx.ellipse(6,-6,24,21,0,0,Math.PI*2);ctx.ellipse(27,3,16,13,0,0,Math.PI*2);ctx.fill();ctx.restore()}
function pipe(x,center){
 const top=center-WORLD.gap/2,bottom=center+WORLD.gap/2,w=WORLD.pipeWidth,grad=ctx.createLinearGradient(x,0,x+w,0);grad.addColorStop(0,'#3c9c88');grad.addColorStop(.3,'#73d6ad');grad.addColorStop(.75,'#53c5a0');grad.addColorStop(1,'#298b7c');
 ctx.fillStyle=grad;ctx.fillRect(x,0,w,top);ctx.fillRect(x,bottom,w,WORLD.ground-bottom);
 ctx.strokeStyle='#267f74';ctx.lineWidth=2;ctx.strokeRect(x,0,w,top);ctx.strokeRect(x,bottom,w,WORLD.ground-bottom);
 round(x-5,top-21,w+10,21,5,'#42a88e');round(x-4,top-20,w+8,16,4,grad);round(x-5,bottom,w+10,21,5,'#42a88e');round(x-4,bottom+1,w+8,16,4,grad);
 ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(x+9,0,5,Math.max(0,top-22));ctx.fillRect(x+9,bottom+22,5,WORLD.ground-bottom-22);
}
function bird(x,y,velocity){
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.max(-.32,Math.min(.55,velocity/700)));
 ctx.fillStyle='#c76f39';ctx.beginPath();ctx.ellipse(-8,7,11,11,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#f8bd57';ctx.beginPath();ctx.ellipse(0,0,16,14,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#cf8445';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#ffe6a2';ctx.beginPath();ctx.ellipse(-7,4,9,6,-.4,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#fffdf4';ctx.beginPath();ctx.arc(7,-5,6.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#27344a';ctx.beginPath();ctx.arc(9,-5,2.5,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#ec8b57';ctx.beginPath();ctx.moveTo(13,1);ctx.lineTo(24,5);ctx.lineTo(13,9);ctx.closePath();ctx.fill();ctx.restore();
}
function draw(){
 const sky=ctx.createLinearGradient(0,0,0,WORLD.ground);sky.addColorStop(0,'#81cce8');sky.addColorStop(.65,'#bde5df');sky.addColorStop(1,'#fbe1b7');ctx.fillStyle=sky;ctx.fillRect(0,0,WORLD.width,WORLD.height);
 ctx.fillStyle='#fff5cd';ctx.beginPath();ctx.arc(286,95,37,0,Math.PI*2);ctx.fill();
 const drift=(game.distance*.09)%480;cloud(46-drift,100,.65);cloud(236-drift,178,.52);cloud(430-drift,86,.8);
 ctx.fillStyle='#9bcab9';ctx.beginPath();ctx.moveTo(0,477);ctx.quadraticCurveTo(55,395,130,471);ctx.quadraticCurveTo(210,388,285,462);ctx.quadraticCurveTo(340,420,360,455);ctx.lineTo(360,552);ctx.lineTo(0,552);ctx.fill();
 ctx.fillStyle='#70ad9b';ctx.beginPath();ctx.moveTo(0,508);ctx.quadraticCurveTo(65,449,145,510);ctx.quadraticCurveTo(230,433,310,503);ctx.quadraticCurveTo(343,480,360,489);ctx.lineTo(360,552);ctx.lineTo(0,552);ctx.fill();
 for(const p of game.pipes)pipe(p.x,p.center);
 ctx.fillStyle='#89b96d';ctx.fillRect(0,WORLD.ground,360,11);ctx.fillStyle='#e6c58f';ctx.fillRect(0,WORLD.ground+11,360,37);ctx.fillStyle='#d5aa78';const offset=(game.distance*.4)%32;for(let x=-32;x<390;x+=32){ctx.fillRect(x-offset,579,18,3)}
 bird(WORLD.birdX,game.y,game.velocity);
}
function frame(time){
 if(!last)last=time;const elapsed=Math.min((time-last)/1000,.05);last=time;
 if(game.state==='playing'){accumulator+=elapsed;while(accumulator>=WORLD.step&&game.state==='playing'){update(WORLD.step);accumulator-=WORLD.step}}else accumulator=0;
 sync();draw();requestAnimationFrame(frame);
}
function fly(){if(game.state==='ready'||game.state==='playing'){flap();sync()}}
function togglePause(){if(game.state==='playing'){pause();accumulator=0;sync()}else if(game.state==='paused'){resume();last=0;sync()}}
$('startButton').addEventListener('click',fly);
$('readyMessage').addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||e.target.closest('button'))return;e.preventDefault();fly()});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();fly()});
$('pauseButton').addEventListener('click',togglePause);$('resumeButton').addEventListener('click',togglePause);
$('retryButton').addEventListener('click',()=>{reset();last=0;lastScore=0;sync();fly()});
window.addEventListener('keydown',e=>{
 if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.target instanceof Element&&e.target.closest('button,a,input,select,textarea'))return;
 if([' ','ArrowUp','w','W'].includes(e.key)){if(['ready','playing'].includes(game.state)){e.preventDefault();fly()}}
 else if(['p','P','Escape'].includes(e.key)){if(['playing','paused'].includes(game.state)){e.preventDefault();togglePause()}}
});
function pauseOnLeave(){if(game.state==='playing'){pause();accumulator=0;sync()}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseOnLeave();else last=0});window.addEventListener('blur',pauseOnLeave);
sync();draw();requestAnimationFrame(frame);
