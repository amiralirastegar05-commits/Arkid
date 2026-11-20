import './messages.js';
import {API_BASE_URL} from './config.js';
import {createRankedGame} from '../worker/src/ranked-2048.js';
const $=id=>document.getElementById(id),status=$('status'),board=$('board');
let auth,userId=null,session=null,game=null,moves=[],busy=true,timer=null;
const say=(text,kind='')=>{status.textContent=text;status.dataset.kind=kind};
function setBusy(value){busy=value;document.querySelectorAll('button,input').forEach(el=>el.disabled=value);updateControls()}
function updateControls(){
 const snapshot=game?.snapshot(),playing=!!snapshot&&session?.status==='open'&&!snapshot.finished&&moves.length<4096&&Date.now()<session.expiresAt;
 document.querySelectorAll('[data-move]').forEach(el=>el.disabled=busy||!playing);
 $('submit').hidden=!snapshot?.finished||session?.status==='completed';$('submit').disabled=busy||!session||Date.now()>=session.expiresAt;
 $('start').disabled=busy||!userId||!!(playing);
}
function message(error){
 const code=error?.message;
 return ({ranked_unavailable:'مسابقه فعلاً فعال نیست. بعداً دوباره سر بزن.',service_unavailable:'اتصال مسابقه برقرار نشد. کمی بعد دوباره تلاش کن.',rank_daily_limit:'سهمیهٔ امروزت تمام شده است. روز بعد به وقت UTC دوباره بازی کن.',rank_attempt_limit:'تعداد تلاش برای ثبت این بازی به سقف رسیده است.',session_expired:'زمان این بازی تمام شده است. می‌توانی مسابقهٔ تازه‌ای شروع کنی.',session_unavailable:'این مسابقه برای حسابت در دسترس نیست.',invalid_game:'نتیجه تأیید نشد. بازی باید طبق قوانین و تا پایان انجام شده باشد.',account_changed:'حساب تغییر کرده است. دوباره وارد شو.',invalid_local:'اطلاعات ذخیره‌شدهٔ این مسابقه قابل خواندن نیست؛ چیزی پاک یا بازنویسی نشده است.',invalid_request:'درخواست معتبر نبود. دوباره تلاش کن.'})[code]||'انجام کار تأیید نشد. اتصال و نتیجه را بررسی کن و دوباره تلاش کن.';
}
async function identity(){const {data,error}=await auth.getSession();if(error)throw error;return data?.session||null}
async function api(path,body){
 const before=await identity();if(!before?.access_token||before.user?.id!==userId)throw Error('account_changed');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let response;
 try{response=await fetch(API_BASE_URL+path,{method:'POST',headers:{Authorization:'Bearer '+before.access_token,'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal})}catch{throw Error('service_unavailable')}finally{clearTimeout(timeout)}
 const after=await identity();if(after?.user?.id!==userId)throw Error('account_changed');
 let result;try{result=await response.json()}catch{throw Error('service_unavailable')}
 if(!response.ok)throw Error(result?.error||'service_unavailable');return result.session;
}
const pendingKey=()=>`arkid.ranked2048.pending.v1.${userId}`;
const gameKey=id=>`arkid.ranked2048.game.v1.${userId}.${id}`;
function readLocal(key){try{const raw=localStorage.getItem(key);if(raw===null)return null;const item=JSON.parse(raw);if(!item||typeof item!=='object'||Array.isArray(item))throw Error();return item}catch{throw Error('invalid_local')}}
function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{$('saveWarning').textContent='ذخیرهٔ محلی در دسترس نیست؛ با بستن صفحه ممکن است ادامهٔ بازی از دست برود.';return false}}
function render(){
 if(!game)return;const state=game.snapshot();$('score').textContent=new Intl.NumberFormat('fa-IR').format(session.status==='completed'?session.points:state.score);
 board.replaceChildren(...state.board.map(value=>{const el=document.createElement('div');el.className='tile';el.dataset.value=String(value);el.dataset.high=String(value>=128);el.setAttribute('role','gridcell');el.setAttribute('aria-label',value?String(value):'خالی');el.textContent=value?String(value):'';return el}));
 if(state.finished&&session.status==='open')say('بازی تمام شد؛ برای ثبت امتیاز دکمهٔ ثبت نتیجه را بزن.');
 else if(moves.length>=4096&&!state.finished)say('این بازی به سقف حرکت رسید و نتیجه‌ای ثبت نمی‌شود.','error');
 updateControls();
}
function clock(){if(!session||session.status==='completed'){$('timer').textContent='';return}const left=Math.max(0,Math.ceil((session.expiresAt-Date.now())/60000));$('timer').textContent='زمان باقی‌مانده: '+new Intl.NumberFormat('fa-IR').format(left)+' دقیقه';if(!left)updateControls()}
function saveMoves(){writeLocal(gameKey(session.id),{version:1,seed:session.seed,moves})}
function move(direction){
 if(busy||!game||session?.status!=='open'||Date.now()>=session.expiresAt||moves.length>=4096)return;
 try{game.step(direction);moves.push(direction);saveMoves();render()}catch(error){if(error?.message!=='invalid_move')say('حرکت انجام نشد.','error')}
}
async function start(){
 if(busy||!userId)return;setBusy(true);say('در حال آماده‌سازی مسابقه…');$('saveWarning').textContent='';
 try{
  let pending=readLocal(pendingKey());
  if(pending&&(!pending.requestId||typeof pending.requestId!=='string'))throw Error('invalid_local');
  if(!pending||pending.done||(pending.expiresAt&&pending.expiresAt<=Date.now())){
    pending={requestId:crypto.randomUUID()};
    // Idempotency must survive a failed response. Do not start if it cannot be saved.
    if(!writeLocal(pendingKey(),pending))throw Error('service_unavailable');
  }
  const result=await api('/v1/ranked/start',{requestId:pending.requestId});
  if(!result||result.rulesVersion!=='2048-v1'||!Number.isInteger(result.seed)||!Number.isSafeInteger(result.expiresAt)||typeof result.id!=='string')throw Error('service_unavailable');
  const saved=readLocal(gameKey(result.id));
  if(saved&&(saved.version!==1||saved.seed!==result.seed||!Array.isArray(saved.moves)||saved.moves.length>4096))throw Error('invalid_local');
  const candidate=createRankedGame(result.seed),steps=saved?.moves||[];
  try{for(const step of steps)candidate.step(step)}catch{throw Error('invalid_local')}
  session=result;game=candidate;moves=steps.slice();
  writeLocal(pendingKey(),{requestId:pending.requestId,expiresAt:result.expiresAt,done:result.status==='completed'});
  $('gamePanel').hidden=false;board.hidden=result.status==='completed'&&!saved;document.querySelector('.direction-pad').hidden=board.hidden;
  if(result.status==='completed')say('این نتیجه قبلاً ثبت شده است: '+new Intl.NumberFormat('fa-IR').format(result.points)+' امتیاز.','success');
  else if(result.expiresAt<=Date.now())say('زمان این بازی تمام شده است. دوباره شروع کن.','error');
  else say('مسابقه آماده است؛ تا پایان بازی ادامه بده.');
  render();clock();if(timer)clearInterval(timer);timer=setInterval(clock,30000);
 }catch(error){say(message(error),'error')}finally{setBusy(false)}
}
async function submit(){
 if(busy||!game?.snapshot().finished||session?.status!=='open')return;setBusy(true);say('در حال بررسی و ثبت نتیجه…');
 try{
  const result=await api('/v1/ranked/submit',{sessionId:session.id,moves});
  if(result?.id!==session.id||result?.status!=='completed'||!Number.isInteger(result.points))throw Error('service_unavailable');
  session=result;const pending=readLocal(pendingKey());if(pending)writeLocal(pendingKey(),{...pending,done:true});
  say('امتیاز تأیید و ثبت شد: '+new Intl.NumberFormat('fa-IR').format(result.points)+' امتیاز ماهانه.','success');clock();
 }catch(error){say(message(error),'error')}finally{setBusy(false)}
}
$('start').addEventListener('click',start);$('submit').addEventListener('click',submit);
document.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>move(button.dataset.move)));
document.addEventListener('keydown',event=>{const direction={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R'}[event.key];if(direction&&game&&!$('gamePanel').hidden&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')){event.preventDefault();move(direction)}});
let touch=null;board.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touch={x:e.clientX,y:e.clientY}});board.addEventListener('pointercancel',()=>{touch=null});board.addEventListener('pointerup',e=>{if(!touch)return;const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;if(Math.max(Math.abs(dx),Math.abs(dy))<30)return;move(Math.abs(dx)>Math.abs(dy)?(dx>0?'R':'L'):(dy>0?'D':'U'))});
$('login').addEventListener('submit',async event=>{event.preventDefault();if(busy)return;setBusy(true);say('در حال ورود…');try{const f=new FormData(event.currentTarget),{error}=await auth.signIn(String(f.get('email')||'').trim(),f.get('password'));if(error)throw error;event.currentTarget.reset();await initialize()}catch(error){say(globalThis.ArkidMessages.message(error,'login'),'error')}finally{setBusy(false)}});
$('signout').addEventListener('click',async()=>{if(busy)return;setBusy(true);try{const {error}=await auth.signOut();if(error)throw error;resetUI();say('از حساب خارج شدی.')}catch{say('خروج تأیید نشد؛ دوباره تلاش کن.','error')}finally{setBusy(false)}});
function resetUI(){userId=null;session=null;game=null;moves=[];if(timer)clearInterval(timer);timer=null;$('gamePanel').hidden=true;$('login').hidden=false;$('signout').hidden=true;board.replaceChildren()}
async function initialize(){const s=await identity();if(s?.user?.id){userId=s.user.id;$('login').hidden=true;$('signout').hidden=false;say('برای شروع یا ادامهٔ مسابقه آماده‌ای.')}else{resetUI();say('برای مسابقه وارد حسابت شو.')}}
setBusy(true);
try{await import('./arcade-auth.js');auth=window.ArkidAuth;auth.onAuthStateChange((_event,s)=>{if(userId&&s?.user?.id!==userId){resetUI();say('حساب تغییر کرده است. دوباره وارد شو.','error')}});await initialize()}catch{say('آماده‌سازی انجام نشد. اتصال را بررسی کن.','error')}finally{setBusy(false)}
