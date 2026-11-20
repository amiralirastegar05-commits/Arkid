import '../cloud/messages.js';

const status = document.getElementById('status');
const form = document.getElementById('login');
const account = document.getElementById('account');
const restore = document.getElementById('restore');
const download = document.getElementById('download');
const replace = document.getElementById('replace');
const downloadLocal = document.getElementById('downloadLocal');
const signout = document.getElementById('signout');
const openGame = document.getElementById('openGame');
const email = document.getElementById('accountEmail');
const say = (message, kind = '') => { status.textContent = message; status.dataset.kind = kind; };
const friendly = (error, context) => globalThis.ArkidMessages.message(error, context);
let auth;
let busy = false;
function setBusy(value) {
  busy = value;
  form.querySelectorAll('input,button').forEach(el => { el.disabled = value; });
  [restore, replace, download, downloadLocal, signout].forEach(el => { el.disabled = value; });
}
async function update() {
  const {data,error} = await auth.getSession();
  if (error) throw error;
  const session = data?.session;
  form.hidden = !!session;
  account.hidden = !session;
  restore.hidden = false;
  replace.hidden = false;
  email.textContent = session?.user?.email || '';
  openGame.hidden = true;
  say(session ? 'حالا می‌تونی پیشرفتت رو برگردونی.' : 'برای ادامه، وارد حسابت شو.');
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || !auth) return;
  const fields = new FormData(form);
  setBusy(true); say('در حال ورود…');
  try {
    const {error} = await auth.signIn(String(fields.get('email') || '').trim(), fields.get('password'));
    if (error) throw error;
    form.reset();
    await update();
  } catch (error) { say(friendly(error, 'login'), 'error'); }
  finally { setBusy(false); }
});
signout.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true); say('در حال خروج…');
  try { const {error} = await auth.signOut(); if (error) throw error; await update(); }
  catch (error) { say(friendly(error), 'error'); }
  finally { setBusy(false); }
});
async function getRemote() {
  const {data,error} = await auth.getSession();
  if (error) throw error;
  const user = data?.session?.user?.id;
  const accountEmail = data?.session?.user?.email || '';
  if (!user) throw Error('Account changed during cloud operation.');
  const remote = await auth.snapshots.readRemote(auth.getClient(), user);
  if (!remote) throw Error('پشتیبان ابری پیدا نشد.');
  await auth.snapshots.requireCurrentUser(auth.getClient(), user);
  return {user, remote, accountEmail};
}
restore.addEventListener('click', async () => {
  if (busy || !confirm('برگه‌های دیگر آرکید را بسته‌ای؟ بازیابی فقط در مرورگر بدون پیشرفت بازی انجام می‌شود.')) return;
  setBusy(true); say('در حال بازیابی پیشرفت…');
  try {
    const {user, remote} = await getRemote();
    auth.snapshots.restoreEmpty(localStorage, user, remote);
    say('پیشرفتت برگشت! حالا می‌تونی بازی رو ادامه بدی.', 'success');
    restore.hidden = true;
    openGame.hidden = false;
  } catch (error) { say(friendly(error, 'restore'), 'error'); }
  finally { setBusy(false); }
});
function saveFile(snapshot, reason, filename) {
  const payload = {__arcadeBackup:true, version:'1.0', exportedAt:new Date().toISOString(), reason, keyCount:Object.keys(snapshot.storage).length, storage:snapshot.storage};
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
downloadLocal.addEventListener('click', () => {
  if (busy || !auth) return;
  try {
    if (localStorage.getItem('arcade_active_session') !== null) throw Error('A game session is active.');
    const data = auth.snapshots.captureLocal(localStorage).data;
    if (!Object.keys(data.storage).length) throw Error('No local game data to back up.');
    saveFile(data, 'local-before-cloud-replacement', 'arkid-local-backup.json');
    say('فایل پشتیبان پیشرفت فعلی آماده شد. آن را در جای امن نگه دار.', 'success');
  } catch (error) { say(friendly(error, 'download'), 'error'); }
});
replace.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true); say('در حال بررسی پشتیبان ابری…');
  try {
    const expected = auth.snapshots.captureLocal(localStorage);
    const {user, remote, accountEmail} = await getRemote();
    if (!Object.keys(remote.data.storage).length) throw Error('Cloud snapshot is empty.');
    const approved = confirm(`حساب مقصد: ${accountEmail || 'حساب واردشده'}\n\nپیشرفت، سکه‌ها، رکوردها و تنظیمات بازی این مرورگر پاک و با پشتیبان ابری این حساب جایگزین می‌شوند؛ با هم ترکیب نمی‌شوند. حساب و پشتیبان ابری پاک نمی‌شوند.\n\nهمهٔ بازی‌ها و برگه‌های دیگر را بسته‌ای؟ اگر از پیشرفت فعلی فایل پشتیبان نگرفته‌ای، لغو کن و ابتدا پشتیبان بگیر.\n\nآیا مطمئنی؟`);
    if (!approved) { say('جایگزینی لغو شد؛ اطلاعات تغییری نکرد.', ''); return; }
    const latest = await getRemote();
    if (latest.user !== user) throw Error('Account changed during cloud operation.');
    if (latest.remote.revision !== remote.revision) throw Error('Cloud snapshot changed during restore.');
    auth.snapshots.replaceLocal(localStorage, user, remote, expected);
    say('پیشرفت این مرورگر با پشتیبان حساب جایگزین شد. حالا می‌تونی بازی کنی.', 'success');
    restore.hidden = true; replace.hidden = true; openGame.hidden = false;
  } catch (error) { say(friendly(error, 'restore'), 'error'); }
  finally { setBusy(false); }
});
download.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true); say('در حال آماده‌سازی فایل…');
  try {
    const {remote} = await getRemote();
    saveFile(remote.data, 'cloud-snapshot', 'arkid-cloud-snapshot.json');
    say('فایل پشتیبان آماده شد. آن را در جای امن نگه دار.', 'success');
  } catch (error) { say(friendly(error, 'download'), 'error'); }
  finally { setBusy(false); }
});
setBusy(true);
try {
  await import('./arcade-auth.js');
  auth = window.ArkidAuth;
  await update();
  setBusy(false);
} catch (error) {
  say('ورود در حال حاضر در دسترس نیست. اتصال اینترنت را بررسی کن و صفحه را دوباره باز کن.', 'error');
}
