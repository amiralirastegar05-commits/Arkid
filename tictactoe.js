import {createMatch} from './tictactoe-engine.js';

const $=id=>document.getElementById(id);
const toFa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const STORE='tictactoe_settings',STATS='tictactoe_stats',TOP='arcade_top_tictactoe';
const DEFAULTS={mode:'solo',difficulty:'normal',theme:'neon',sound:true};
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let settings=readSettings();
let stats=readStats();
let round=0,starter='X',match,busy=false,timer=null,settled=false,lastMove=-1;
let audio=null;

function readSettings(){
  const value={...DEFAULTS};
  try{
    const saved=JSON.parse(localStorage.getItem(STORE)||'null')||{};
    if(saved.mode==='solo'||saved.mode==='duo')value.mode=saved.mode;
    if(['easy','normal','hard'].includes(saved.difficulty))value.difficulty=saved.difficulty;
    if(saved.theme==='neon'||saved.theme==='amber')value.theme=saved.theme;
    if(typeof saved.sound==='boolean')value.sound=saved.sound;
  }catch(_){}
  return value;
}
function readStats(){
  const blank={wins:0,losses:0,draws:0,streak:0,best:0};
  try{
    const saved=JSON.parse(localStorage.getItem(STATS)||'null')||{};
    for(const key of Object.keys(blank))if(Number.isFinite(saved[key])&&saved[key]>=0)blank[key]=Math.floor(saved[key]);
    const top=Math.max(0,parseInt(localStorage.getItem(TOP)||'0',10)||0);
    blank.best=Math.max(blank.best,top);
  }catch(_){}
  return blank;
}
function saveStats(){
  try{
    localStorage.setItem(STATS,JSON.stringify(stats));
    if(stats.best>0)localStorage.setItem(TOP,String(stats.best));
  }catch(_){}
}
function saveSettings(){try{localStorage.setItem(STORE,JSON.stringify(settings))}catch(_){}}
function tone(freq,duration,type='triangle',volume=.05,delay=0){
  if(!settings.sound)return;
  try{
    audio=audio||new (window.AudioContext||window.webkitAudioContext)();
    const start=audio.currentTime+delay,osc=audio.createOscillator(),gain=audio.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,start);osc.connect(gain);gain.connect(audio.destination);
    gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.start(start);osc.stop(start+duration);
  }catch(_){}
}
const sound={
  place:()=>tone(560,.07),
  ai:()=>tone(430,.07,'sine',.045),
  win:()=>{tone(660,.12);tone(880,.12,'triangle',.05,.1);tone(1120,.18,'triangle',.045,.2)},
  lose:()=>{tone(300,.14,'sawtooth',.045);tone(220,.2,'sawtooth',.04,.12)},
  draw:()=>{tone(520,.1);tone(520,.12,'sine',.04,.14)}
};

const board=$('board'),cells=[];
for(let i=0;i<9;i++){
  const cell=document.createElement('button');
  cell.type='button';cell.className='cell';cell.dataset.index=String(i);
  cell.setAttribute('role','gridcell');cell.setAttribute('aria-label',`خانهٔ ${toFa(i+1)}، خالی`);
  cell.tabIndex=i===0?0:-1;
  cell.addEventListener('click',()=>humanMove(i));
  cell.addEventListener('keydown',boardKeys);
  cells.push(cell);board.append(cell);
}
const markSVG=mark=>mark==='X'
  ?'<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M26 26 74 74M74 26 26 74"/></svg>'
  :'<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="25"/></svg>';

function boardKeys(event){
  const keys={ArrowRight:-1,ArrowLeft:1,ArrowUp:-3,ArrowDown:3};
  if(event.key==='Home'||event.key==='End'){event.preventDefault();focusCell(event.key==='Home'?0:8);return}
  if(!(event.key in keys))return;
  event.preventDefault();
  const current=Number(event.currentTarget.dataset.index);
  let next=current+keys[event.key];
  if(next<0||next>8)next=current;
  focusCell(next);
}
function focusCell(index){
  cells.forEach((cell,i)=>cell.tabIndex=i===index?0:-1);
  cells[index].focus({preventScroll:true});
}

function newRound(alternate=true){
  clearTimeout(timer);timer=null;busy=false;settled=false;lastMove=-1;
  if(alternate)round++;
  starter=settings.mode==='duo'?'X':(round%2===0?'X':'O');
  match=createMatch({mode:settings.mode,difficulty:settings.difficulty,starter});
  $('resultMessage').hidden=true;$('strike').classList.add('off');$('strike').classList.remove('draw-anim');
  $('stageNote').textContent=settings.mode==='duo'?'نوبت بازیکن ۱ (×) است.':'نوبت توست؛ یک خانه را انتخاب کن.';
  render();
  if(settings.mode==='solo'&&match.game.turn===match.game.ai)queueAI();
}
function humanMove(index){
  if(busy||match.game.status!=='playing')return;
  if(match.game.mode==='solo'&&match.game.turn!==match.game.human)return;
  const outcome=match.play(index);
  if(!outcome.ok)return;
  lastMove=index;sound.place();
  render();
  if(match.game.status==='playing'){if(match.game.mode==='solo')queueAI()}
  else finish();
}
function queueAI(){
  busy=true;render();
  clearTimeout(timer);
  timer=setTimeout(()=>{
    if(document.hidden||match.game.status!=='playing'){busy=false;render();return}
    const index=match.aiMove();
    busy=false;
    if(index!==null){lastMove=index;sound.ai()}
    render();
    if(match.game.status!=='playing')finish();
  },reduced?120:430);
}
function finish(){
  if(settled)return;
  settled=true;
  const outcome=match.game.result,human=match.game.human;
  let kind='draw';
  if(outcome&&outcome.winner){kind=match.game.mode==='solo'?(outcome.winner===human?'win':'lose'):'win'}
  if(match.game.mode==='solo'){
    if(kind==='win'){stats.wins++;stats.streak++;stats.best=Math.max(stats.best,stats.streak);sound.win()}
    else if(kind==='lose'){stats.losses++;stats.streak=0;sound.lose()}
    else {stats.draws++;stats.streak=0;sound.draw()}
    saveStats();
  }else{
    if(kind==='win')sound.win();else sound.draw();
  }
  showResult(kind,outcome);
  render();
  setTimeout(()=>$('againButton').focus({preventScroll:true}),60);
}
function showResult(kind,outcome){
  const box=$('resultMessage'),title=$('resultTitle'),text=$('resultText'),icon=$('resultIcon');
  box.hidden=false;box.className='result '+kind;
  if(kind==='win'){
    title.textContent=match.game.mode==='solo'?'بردی!':'بازیکن × برد';
    text.textContent=match.game.mode==='solo'?`رشتهٔ بردهای پیاپی: ${toFa(stats.streak)}`:'خط کامل شد؛ دست داد!';
    icon.textContent='✦';
  }else if(kind==='lose'){
    title.textContent='باختی';text.textContent='حریف سخت اشتباه نمی‌کند؛ یک بار دیگر امتحان کن.';icon.textContent='✧';
  }else{
    title.textContent='مساوی';text.textContent='هیچ‌کس خط نساخت؛ بازی را دوباره شروع کن.';icon.textContent='◇';
  }
  $('status').textContent=`${title.textContent} ${text.textContent}`;
  const line=outcome&&outcome.line;
  if(line){
    const centers=line.map(i=>[50+(i%3)*100,50+Math.floor(i/3)*100]);
    const [a,b]=centers,dx=b[0]-a[0],dy=b[1]-a[1],dist=Math.hypot(dx,dy),ux=dx/dist,uy=dy/dist,pad=20;
    const svgLine=$('strikeLine');
    svgLine.setAttribute('x1',String(a[0]-ux*pad));svgLine.setAttribute('y1',String(a[1]-uy*pad));
    svgLine.setAttribute('x2',String(b[0]+ux*pad));svgLine.setAttribute('y2',String(b[1]+uy*pad));
    const strike=$('strike');strike.classList.remove('off','draw-anim');void strike.getBoundingClientRect();
    const length=Math.hypot(Number(svgLine.getAttribute('x2'))-Number(svgLine.getAttribute('x1')),Number(svgLine.getAttribute('y2'))-Number(svgLine.getAttribute('y1')));
    svgLine.style.strokeDasharray=String(length);svgLine.style.strokeDashoffset='0';
    if(!reduced&&typeof svgLine.animate==='function')svgLine.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:420,easing:'ease-out'});
  }else $('strike').classList.add('off');
  $('stageNote').textContent=match.game.mode==='solo'?'برای ادامه، بازی تازه را بزن.':'برای ادامه، بازی تازه را بزن.';
}
function render(){
  const g=match.game;
  cells.forEach((cell,i)=>{
    const mark=g.board[i];
    cell.className='cell'+(mark?' '+mark.toLowerCase():'')+(i===lastMove?' place':'');
    cell.innerHTML=mark?markSVG(mark):'';
    const winning=!!(g.result&&g.result.line&&g.result.line.includes(i));
    if(winning)cell.classList.add('win');
    cell.setAttribute('aria-label',`خانهٔ ${toFa(i+1)}، ${mark?(mark==='X'?'ضربدر':'دایره'):'خالی'}`);
    cell.setAttribute('aria-selected',mark?'true':'false');
    cell.disabled=g.status!=='playing'||busy||(g.mode==='solo'&&g.turn!==g.human);
  });
  const chip=$('turnChip');
  if(g.status!=='playing'){chip.textContent=g.result&&g.result.winner?g.result.winner:'–';chip.classList.toggle('o',chip.textContent==='O')}
  else{chip.textContent=g.turn;chip.classList.toggle('o',g.turn==='O')}
  let label='';
  if(g.status!=='playing')label='دست تمام شد';
  else if(g.mode==='duo')label=g.turn==='X'?'نوبت بازیکن ۱':'نوبت بازیکن ۲';
  else if(busy||g.turn===g.ai)label='هوش مصنوعی فکر می‌کند…';
  else label='نوبت تو';
  $('turnText').textContent=label;
  $('turnPill').setAttribute('aria-label',label);
  if(g.status==='playing')$('stageNote').textContent=g.mode==='duo'?(g.turn==='X'?'نوبت بازیکن ۱؛ یک خانه را انتخاب کن.':'نوبت بازیکن ۲؛ یک خانه را انتخاب کن.'):(busy||g.turn===g.ai?'هوش مصنوعی دارد فکر می‌کند…':'نوبت توست؛ یک خانه را انتخاب کن.');
  $('wins').textContent=toFa(stats.wins);$('losses').textContent=toFa(stats.losses);
  $('draws').textContent=toFa(stats.draws);$('best').textContent=toFa(stats.best);
  $('stage').dataset.theme=settings.theme;
  $('themeColor').setAttribute('content',settings.theme==='amber'?'#120c09':'#0b1220');
}
function applySettings(){
  for(const el of document.querySelectorAll('[data-mode]')){const on=el.dataset.mode===settings.mode;el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on))}
  for(const el of document.querySelectorAll('[data-difficulty]')){const on=el.dataset.difficulty===settings.difficulty;el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on));el.disabled=settings.mode==='duo'}
  for(const el of document.querySelectorAll('[data-theme-choice]')){const on=el.dataset.themeChoice===settings.theme;el.classList.toggle('on',on);el.setAttribute('aria-pressed',String(on))}
  $('soundToggle').setAttribute('aria-checked',String(settings.sound));$('soundToggle').classList.toggle('on',settings.sound);
}
function change(patch,{reset=false}={}){
  const modeChanged=patch.mode&&patch.mode!==settings.mode;
  Object.assign(settings,patch);saveSettings();applySettings();
  if(reset||modeChanged){if(modeChanged)round=0;newRound(!modeChanged)}
  else render();
}

$('settingsButton').addEventListener('click',()=>{
  if($('settingsDialog').open)return;
  $('settingsDialog').showModal();$('settingsButton').setAttribute('aria-expanded','true');
});
$('settingsLink').addEventListener('click',()=>$('settingsButton').click());
$('closeSettings').addEventListener('click',()=>$('settingsDialog').close());
$('settingsDialog').addEventListener('close',()=>$('settingsButton').setAttribute('aria-expanded','false'));
for(const tab of document.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>{
  for(const other of document.querySelectorAll('[data-tab]')){const on=other===tab;other.classList.toggle('on',on);other.setAttribute('aria-selected',String(on))}
  $('panelGame').hidden=tab.dataset.tab!=='game';$('panelLook').hidden=tab.dataset.tab!=='look';
});
for(const el of document.querySelectorAll('[data-mode]'))el.addEventListener('click',()=>change({mode:el.dataset.mode}));
for(const el of document.querySelectorAll('[data-difficulty]'))el.addEventListener('click',()=>{if(settings.mode==='solo')change({difficulty:el.dataset.difficulty})});
for(const el of document.querySelectorAll('[data-theme-choice]'))el.addEventListener('click',()=>change({theme:el.dataset.themeChoice}));
$('soundToggle').addEventListener('click',()=>{change({sound:!settings.sound});if(settings.sound)sound.place()});
$('newGameButton').addEventListener('click',()=>newRound());
$('againButton').addEventListener('click',()=>{newRound();focusCell(0)});
window.addEventListener('keydown',event=>{
  if($('settingsDialog').open||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.target instanceof Element&&event.target.closest('dialog'))return;
  if(event.key==='n'||event.key==='N'||event.key==='Escape'){if(!event.repeat)newRound()}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer){clearTimeout(timer);timer=null;busy=false;render()}});

applySettings();newRound(false);
