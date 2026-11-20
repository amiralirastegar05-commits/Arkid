import './messages.js';
import {currentUser,socialCall} from './social.js';
const $=id=>document.getElementById(id),status=$('status');let auth,userId=null,busy=true;
const say=(text,kind='')=>{status.textContent=text;status.dataset.kind=kind};
function setBusy(value){busy=value;document.querySelectorAll('button,input').forEach(el=>el.disabled=value)}
function node(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el}
function button(text,callback){const el=node('button',text,'small-button');el.type='button';el.addEventListener('click',callback);return el}
function errorText(error,write=false){const raw=String(error?.message||'');if(raw.includes('report_unavailable'))return 'این گزارش قبلاً بررسی شده است؛ فهرست را به‌روزرسانی کن.';if(raw.includes('not_moderator'))return 'دسترسی بررسی برای این حساب فعال نیست.';if(raw.includes('account_changed')||raw.includes('sign_in_required'))return 'حساب تغییر کرده است. دوباره وارد شو.';if(error?.code==='PGRST202'||error?.code==='42883')return 'بخش بررسی هنوز فعال نشده است.';return write?'ثبت نتیجه تأیید نشد؛ ممکن است انجام شده باشد. فهرست را به‌روزرسانی کن.':globalThis.ArkidMessages.message(error,'login')}
function render(rows){
 const target=$('reports');target.replaceChildren();if(!rows.length){target.append(node('p','گزارش تازه‌ای برای بررسی نیست.','social-empty'));return}
 const reasons={harassment:'مزاحمت',inappropriate:'محتوای نامناسب',spam:'هرزنامه',other:'دلیل دیگر'};
 for(const row of rows){
  const card=document.createElement('article');card.className='social-card';
  card.append(node('strong',row.kind==='profile'?'گزارش پروفایل':'گزارش نام تیم'),node('p','دلیل: '+(reasons[row.reason]||'نامشخص')),
    node('p','نام ثبت‌شده: '+row.name_snapshot),node('p',row.kind==='profile'?'بیوی ثبت‌شده: '+row.bio_snapshot:'', 'hint'),
    node('p','شناسهٔ مورد: '+(row.subject_id||'حساب حذف شده'),'hint'));
  const actions=document.createElement('div');actions.className='actions';
  actions.append(button('بررسی شد',()=>resolve(row,'reviewed')),button('رد گزارش',()=>resolve(row,'dismissed')));card.append(actions);target.append(card);
 }
}
async function load(){
 const client=auth.getClient(),id=await currentUser(client);
 const allowed=await socialCall(client,id,'arkid_is_moderator');userId=id;
 $('loginPanel').hidden=true;$('signout').hidden=false;$('deniedPanel').hidden=allowed;$('reviewPanel').hidden=!allowed;
 if(!allowed){$('ownId').textContent=id;$('reports').replaceChildren();say('');return}
 const rows=await socialCall(client,id,'arkid_moderation_queue');render(rows||[]);say('');
}
async function resolve(row,outcome){
 if(busy||!confirm(outcome==='reviewed'?'این گزارش به‌عنوان بررسی‌شده ثبت شود؟ هیچ اقدام دیگری خودکار انجام نمی‌شود.':'این گزارش رد شود؟ محتوای گزارش حذف نمی‌شود.'))return;
 setBusy(true);say('در حال ثبت نتیجهٔ بررسی…');
 try{await socialCall(auth.getClient(),userId,'arkid_moderation_resolve',{kind:row.kind,report:row.report_id,outcome});await load();say('نتیجهٔ بررسی ثبت شد.','success')}
 catch(error){say(errorText(error,true),'error')}finally{setBusy(false)}
}
$('refresh').addEventListener('click',async()=>{if(busy)return;setBusy(true);say('در حال دریافت گزارش‌ها…');try{await load()}catch(error){say(errorText(error),'error')}finally{setBusy(false)}});
$('login').addEventListener('submit',async event=>{event.preventDefault();if(busy||!auth)return;setBusy(true);say('در حال ورود…');try{const f=new FormData(event.currentTarget),{error}=await auth.signIn(String(f.get('email')||'').trim(),f.get('password'));if(error)throw error;event.currentTarget.reset();await load()}catch(error){say(errorText(error),'error')}finally{setBusy(false)}});
$('signout').addEventListener('click',async()=>{if(busy)return;setBusy(true);try{const {error}=await auth.signOut();if(error)throw error;resetUI();say('از حساب خارج شدی.')}catch{say('خروج تأیید نشد؛ دوباره تلاش کن.','error')}finally{setBusy(false)}});
function resetUI(){userId=null;$('loginPanel').hidden=false;$('reviewPanel').hidden=true;$('deniedPanel').hidden=true;$('signout').hidden=true;$('ownId').textContent='';$('reports').replaceChildren()}
setBusy(true);
try{await import('./arcade-auth.js');auth=window.ArkidAuth;auth.onAuthStateChange((_event,session)=>{if(userId&&session?.user?.id!==userId){resetUI();say('حساب تغییر کرده است. دوباره وارد شو.','error')}});const {data,error}=await auth.getSession();if(error)throw error;if(data?.session?.user?.id)await load();else say('برای بررسی گزارش‌ها وارد حسابت شو.');setBusy(false)}catch(error){say(errorText(error),'error');if(auth)setBusy(false)}
