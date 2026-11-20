import './messages.js';
import {currentUser,socialCall} from './social.js';
import {requireUser} from './public-profile.js';

const $ = id => document.getElementById(id);
const status=$('status'), login=$('login'), loginPanel=$('loginPanel'), content=$('socialContent');
let auth, userId=null, team=null, busy=true;
const say=(text,kind='')=>{status.textContent=text;status.dataset.kind=kind};
function setBusy(value){busy=value;document.querySelectorAll('button,input,select').forEach(el=>{el.disabled=value})}
function message(error, action=''){
  const s=String(error?.message||'').toLowerCase();
  const cases=[['already_in_team','هر بازیکن فعلاً فقط می‌تواند عضو یک تیم باشد.'],['not_team_owner','فقط مدیر تیم می‌تواند دعوت بفرستد.'],['team_full','ظرفیت این تیم پر شده است.'],['team_creation_limited','تعداد تیم‌های ساخته‌شده زیاد بوده است. بعداً دوباره تلاش کن.'],['team_unavailable','این تیم فعلاً در دسترس نیست.'],['player_unavailable','این بازیکن فعلاً برای دعوت در دسترس نیست.'],['invite_recent','به این بازیکن اخیراً دعوت فرستاده‌ای. کمی بعد دوباره تلاش کن.'],['invite_rate_limited','تعداد دعوت‌ها زیاد بوده است. بعداً دوباره تلاش کن.'],['search_rate_limited','تعداد جست‌وجوها زیاد بوده است. کمی بعد دوباره تلاش کن.'],['report_rate_limited','تعداد گزارش‌های امروز به سقف رسیده است. فردا دوباره تلاش کن.'],['report_recent','این پروفایل را اخیراً گزارش کرده‌ای. بعداً دوباره تلاش کن.'],['block_limit','فهرست مسدودسازی پر است. ابتدا یک مورد را رفع مسدودسازی کن.'],['block_rate_limited','تعداد مسدودسازی‌ها زیاد بوده است. کمی بعد دوباره تلاش کن.'],['rank_rate_limited','تعداد بررسی رتبه‌ها زیاد بوده است. کمی بعد دوباره تلاش کن.'],['invalid_period','این ماه برای نمایش معتبر نیست.'],['invalid_search','برای جست‌وجو بین ۲ تا ۴۰ نویسه وارد کن.'],['invalid_team_name','نام تیم باید بین ۲ تا ۳۲ نویسه باشد.'],['transfer_required','پیش از خروج، مدیریت را به یکی از اعضای تیم بسپار.'],['no_team','فعلاً عضو تیمی نیستی.'],['owner_exists','این تیم اکنون مدیر دارد.'],['invite_unavailable','این دعوت دیگر در دسترس نیست.'],['account_changed','حساب تغییر کرده است. دوباره وارد شو.'],['sign_in_required','برای ادامه دوباره وارد شو.']];
  for(const [key,text] of cases) if(s.includes(key)) return text;
  if(error?.code==='PGRST202'||error?.code==='42883') return 'این بخش هنوز فعال نشده است. کمی بعد دوباره تلاش کن.';
  if(action==='write') return 'انجام کار تأیید نشد؛ ممکن است ثبت شده باشد. صفحه را به‌روزرسانی و نتیجه را بررسی کن.';
  return globalThis.ArkidMessages.message(error,'login');
}
function empty(text){const p=document.createElement('p');p.className='social-empty';p.textContent=text;return p}
function node(tag,text,className){const el=document.createElement(tag);if(className)el.className=className;el.textContent=text;return el}
function actionButton(text,fn){const b=node('button',text,'small-button');b.type='button';b.addEventListener('click',fn);return b}
function reportControls(label,button,callback){
  const actions=document.createElement('div');actions.className='actions safety-actions';
  const reason=document.createElement('select');reason.setAttribute('aria-label',label);
  for(const [value,text] of [['harassment','مزاحمت'],['inappropriate','محتوای نامناسب'],['spam','هرزنامه'],['other','دلیل دیگر']]){const option=node('option',text);option.value=value;reason.append(option)}
  actions.append(reason,actionButton(button,()=>callback(reason.value)));return actions;
}
function renderTeam(row){
  team=row||null;const box=$('team');box.replaceChildren();$('createTeam').hidden=!!team;
  if(!team){box.append(empty('هنوز عضو تیمی نیستی. می‌توانی تیم بسازی یا دعوتی را بپذیری.'));return}
  const heading=node('strong',team.team_name);box.append(heading);
  box.append(node('p',team.owner_id===userId?'تو مدیر این تیم هستی.':'عضو تیم هستی.'));
  const list=document.createElement('ul');list.className='team-members';
  for(const member of team.members||[]){
    const suffix=member.user_id===team.owner_id?' · مدیر':'';
    const li=node('li',(member.display_name||'بازیکن')+suffix);
    if(team.owner_id===userId&&member.user_id!==userId) li.append(actionButton('واگذاری مدیریت',()=>transfer(member)));
    list.append(li);
  }
  box.append(list);
  if(!team.owner_id){box.append(node('p','این تیم فعلاً مدیر ندارد. یکی از اعضا می‌تواند مدیریت آن را بپذیرد.'));box.append(actionButton('پذیرش مدیریت',claimTeam))}
  box.append(actionButton('خروج از تیم',leaveTeam));
  box.append(reportControls('دلیل گزارش نام تیم '+team.team_name,'گزارش نام تیم',reason=>reportTeam({team:team.team_id,invite:null},reason)));
}
function renderInbox(items){
  const box=$('inbox');box.replaceChildren();
  if(!items.length){box.append(empty('فعلاً دعوت تازه‌ای نداری.'));return}
  for(const item of items){
    const card=document.createElement('article');card.className='social-card';
    card.append(node('strong','دعوت به '+item.team_name));card.append(node('p',(item.sender_name||'یک بازیکن')+' از تو دعوت کرده به تیم بپیوندی.'));
    const actions=document.createElement('div');actions.className='actions';
    for(const [label,accepted] of [['پذیرفتن',true],['رد کردن',false]]) actions.append(actionButton(label,()=>respond(item.invite_id,accepted)));
    actions.append(actionButton('مسدود کردن فرستنده',()=>blockInviteSender(item.invite_id)));
    card.append(actions,reportControls('دلیل گزارش نام تیم '+item.team_name,'گزارش نام تیم',reason=>reportTeam({team:null,invite:item.invite_id},reason)));box.append(card);
  }
}
function renderAnnouncements(items){
  const box=$('announcements');box.replaceChildren();
  if(!items.length){box.append(empty('فعلاً خبر تازه‌ای نیست.'));return}
  for(const item of items){
    const card=document.createElement('article');card.className='social-card';
    card.append(node('strong',item.title),node('p',item.body));
    if(item.is_read)card.append(node('p','خوانده‌شده','hint'));
    else card.append(actionButton('خواندم',()=>markAnnouncement(item.announcement_id)));
    box.append(card);
  }
}
async function markAnnouncement(id){
  if(busy)return;setBusy(true);say('در حال ثبت…');
  try{await socialCall(auth.getClient(),userId,'arkid_read_announcement',{notice:id});await dashboard();say('خبر به‌عنوان خوانده‌شده ثبت شد.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
function renderRankings(items){
  const box=$('rankings');box.replaceChildren();
  if(!items.length){box.append(empty('هنوز رتبه‌ای برای نمایش وجود ندارد.'));return}
  for(const item of items){
    const card=document.createElement('article');card.className='social-card';
    card.append(node('strong',String(item.place)+' · '+item.display_name),node('p',String(item.points)+' امتیاز ماهانه'));
    box.append(card);
  }
}
function renderResults(items){
  const box=$('results');box.replaceChildren();
  if(!items.length){box.append(empty('بازیکنی با این نام پیدا نشد.'));return}
  for(const item of items){
    const card=document.createElement('article');card.className='social-card';
    card.append(node('strong',item.display_name));card.append(node('p',item.bio||'هنوز بیوگرافی ندارد.'));
    card.append(node('p','شناسهٔ کوتاه: '+String(item.user_id).slice(0,8),'hint'));
    const actions=document.createElement('div');actions.className='actions';
    if(team?.owner_id===userId) actions.append(actionButton('دعوت به تیم',()=>invite(item)));
    else card.append(node('p',team?'فقط مدیر تیم می‌تواند دعوت بفرستد.':'برای دعوت، ابتدا تیم بساز.','hint'));
    actions.append(actionButton('مسدود کردن دعوت‌ها',()=>setBlock(item.user_id,true)));
    card.append(actions,reportControls('دلیل گزارش پروفایل '+item.display_name,'گزارش پروفایل',reason=>reportProfile(item,reason)));
    box.append(card);
  }
}
function renderBlocks(items){
  const box=$('blocks');box.replaceChildren();
  if(!items.length){box.append(empty('بازیکنی را مسدود نکرده‌ای.'));return}
  for(const item of items){
    const card=document.createElement('article');card.className='social-card';
    card.append(node('strong',item.display_name),node('p','شناسهٔ کوتاه: '+String(item.user_id).slice(0,8),'hint'),actionButton('رفع مسدودسازی',()=>setBlock(item.user_id,false)));
    box.append(card);
  }
}
async function setBlock(target,blocked){
  if(busy||!confirm(blocked?'دعوت بین شما مسدود شود؟ عضویت فعلی تیم تغییر نمی‌کند.':'مسدودسازی دعوت‌ها برداشته شود؟'))return;
  setBusy(true);say('در حال ثبت…');
  try{await socialCall(auth.getClient(),userId,'arkid_set_player_block',{target,blocked});await dashboard();say(blocked?'دعوت‌ها مسدود شدند.':'مسدودسازی برداشته شد.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
async function blockInviteSender(invite){
  if(busy||!confirm('دعوت بین شما و فرستنده مسدود شود؟ دعوت فعلی حذف نمی‌شود و می‌توانی آن را رد کنی.'))return;
  setBusy(true);say('در حال ثبت…');
  try{await socialCall(auth.getClient(),userId,'arkid_block_invite_sender',{invite});await dashboard();say('دعوت‌های فرستنده مسدود شدند.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
async function reportProfile(item,reason){
  if(busy||!confirm('پروفایل عمومی «'+item.display_name+'» برای بررسی انسانی گزارش شود؟ نام و بیوی فعلی در گزارش ذخیره می‌شوند.'))return;
  setBusy(true);say('در حال ارسال گزارش…');
  try{await socialCall(auth.getClient(),userId,'arkid_report_profile',{target:item.user_id,report_reason:reason});say('گزارش ثبت شد؛ بررسی آن خودکار نیست.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
async function reportTeam(reference,reason){
  if(busy||!confirm('نام این تیم برای بررسی انسانی گزارش شود؟ نام فعلی تیم در گزارش ذخیره می‌شود.'))return;
  setBusy(true);say('در حال ارسال گزارش…');
  try{await socialCall(auth.getClient(),userId,'arkid_report_team',{...reference,report_reason:reason});say('گزارش ثبت شد؛ بررسی آن خودکار نیست.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
async function dashboard(){
  const client=auth.getClient();const id=await currentUser(client);
  const month=$('rankMonth').value;
  const rankArgs=month?{period:month+'-01'}:{};
  const [rows,inbox,announcements,rankings,blocks]=await Promise.all([
    socialCall(client,id,'arkid_my_team'),socialCall(client,id,'arkid_team_inbox'),
    socialCall(client,id,'arkid_announcement_feed').then(value=>({value}),error=>({error})),
    socialCall(client,id,'arkid_monthly_leaderboard',rankArgs).then(value=>({value}),error=>({error})),
    socialCall(client,id,'arkid_my_blocks').then(value=>({value}),error=>({error}))
  ]);
  await requireUser(client,id);
  userId=id;renderTeam(rows?.[0]||null);renderInbox(inbox||[]);
  if(announcements.error)$('announcements').replaceChildren(empty(message(announcements.error)));else renderAnnouncements(announcements.value||[]);
  if(rankings.error)$('rankings').replaceChildren(empty(message(rankings.error)));else renderRankings(rankings.value||[]);
  if(blocks.error)$('blocks').replaceChildren(empty(message(blocks.error)));else renderBlocks(blocks.value||[]);
  $('results').replaceChildren();
  loginPanel.hidden=true;content.hidden=false;say('');
}
async function claimTeam(){
  if(busy||!confirm('مدیریت این تیم را می‌پذیری؟'))return;
  setBusy(true);say('در حال ثبت…');
  try{await socialCall(auth.getClient(),userId,'arkid_claim_team_owner');await dashboard();say('مدیریت تیم را پذیرفتی.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
async function leaveTeam(){
  if(busy||!team||!confirm('می‌خواهی از این تیم خارج شوی؟ اگر مدیر تیمی با اعضای دیگر هستی، ابتدا باید مدیریت را واگذار کنی.'))return;
  setBusy(true);say('در حال خروج از تیم…');
  try{await socialCall(auth.getClient(),userId,'arkid_leave_team');await dashboard();say('از تیم خارج شدی.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
async function transfer(member){
  if(busy||!confirm('مدیریت تیم به «'+member.display_name+'» واگذار شود؟'))return;
  setBusy(true);say('در حال واگذاری مدیریت…');
  try{await socialCall(auth.getClient(),userId,'arkid_transfer_team_owner',{target:member.user_id});await dashboard();say('مدیریت واگذار شد.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
async function respond(id,accept){
  if(busy)return;
  if(accept&&!confirm('با پذیرفتن، عضو این تیم می‌شوی. ادامه می‌دهی؟'))return;
  setBusy(true);say('در حال ثبت پاسخ…');
  try{await socialCall(auth.getClient(),userId,'arkid_respond_team_invite',{invite:id,accept_invite:accept});await dashboard();say(accept?'به تیم پیوستی!':'دعوت رد شد.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
async function invite(item){
  if(busy||!team||!confirm('برای «'+item.display_name+'» با شناسهٔ '+String(item.user_id).slice(0,8)+' دعوت بفرستیم؟'))return;
  setBusy(true);say('در حال ارسال دعوت…');
  try{await socialCall(auth.getClient(),userId,'arkid_invite_player',{team:team.team_id,target:item.user_id});say('دعوت ارسال شد. بازیکن باید آن را بپذیرد.','success')}
  catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
}
login.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!auth)return;const fields=new FormData(login);setBusy(true);say('در حال ورود…');
  try{const {error}=await auth.signIn(String(fields.get('email')||'').trim(),fields.get('password'));if(error)throw error;login.reset();await dashboard()}
  catch(error){say(message(error),'error')}finally{setBusy(false)}
});
$('createTeam').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const n=String(new FormData(e.currentTarget).get('teamName')||'').trim();
  if(!confirm('تیم «'+n+'» ساخته شود؟ در هر زمان فقط می‌توانی عضو یک تیم باشی.'))return;
  setBusy(true);say('در حال ساخت تیم…');try{await socialCall(auth.getClient(),userId,'arkid_create_team',{team_name:n});await dashboard();say('تیمت ساخته شد!','success')}catch(error){say(message(error,'write'),'error')}finally{setBusy(false)}
});
$('search').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const q=$('searchText').value.trim();setBusy(true);say('در حال جست‌وجو…');
  try{const rows=await socialCall(auth.getClient(),userId,'arkid_search_players',{query_text:q});renderResults(rows||[]);say('')}
  catch(error){say(message(error),'error')}finally{setBusy(false)}
});
$('rankForm').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const month=$('rankMonth').value;setBusy(true);say('در حال دریافت رتبه‌ها…');
  try{const rows=await socialCall(auth.getClient(),userId,'arkid_monthly_leaderboard',month?{period:month+'-01'}:{});renderRankings(rows||[]);say('')}
  catch(error){say(message(error),'error')}finally{setBusy(false)}
});
$('refresh').addEventListener('click',async()=>{if(busy)return;setBusy(true);say('در حال به‌روزرسانی…');try{await dashboard()}catch(error){say(message(error),'error')}finally{setBusy(false)}});
$('signout').addEventListener('click',async()=>{if(busy)return;setBusy(true);try{const {error}=await auth.signOut();if(error)throw error;resetUI();say('از حساب خارج شدی.')}catch(error){say(message(error),'error')}finally{setBusy(false)}});
function resetUI(){userId=null;team=null;content.hidden=true;loginPanel.hidden=false;for(const id of ['team','inbox','announcements','rankings','blocks','results'])$(id).replaceChildren()}
setBusy(true);
try{
  await import('./arcade-auth.js');auth=window.ArkidAuth;
  auth.onAuthStateChange((_event,session)=>{if(userId&&session?.user?.id!==userId){resetUI();say('حساب تغییر کرده است. دوباره وارد شو.','error')}});
  const {data,error}=await auth.getSession();if(error)throw error;
  if(data?.session?.user?.id)await dashboard();else say('برای ادامه وارد حسابت شو.');
  setBusy(false);
}catch(error){say(message(error),'error');if(auth)setBusy(false)}
