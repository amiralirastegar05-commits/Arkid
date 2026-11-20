import '../cloud/messages.js';

const status = document.getElementById('status');
const form = document.getElementById('login');
const account = document.getElementById('account');
const restore = document.getElementById('restore');
const download = document.getElementById('download');
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
  [restore, download, signout].forEach(el => { el.disabled = value; });
}
async function update() {
  const {data,error} = await auth.getSession();
  if (error) throw error;
  const session = data?.session;
  form.hidden = !!session;
  account.hidden = !session;
  restore.hidden = false;
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
  if (!user) throw Error('Account changed during cloud operation.');
  const remote = await auth.snapshots.readRemote(auth.getClient(), user);
  if (!remote) throw Error('پشتیبان ابری پیدا نشد.');
  await auth.snapshots.requireCurrentUser(auth.getClient(), user);
  return {user, remote};
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
download.addEventListener('click', async () => {
  if (busy) return;
  setBusy(true); say('در حال آماده‌سازی فایل…');
  try {
    const {remote} = await getRemote();
    const payload = {__arcadeBackup:true, version:'1.0', exportedAt:new Date().toISOString(), reason:'cloud-snapshot', keyCount:Object.keys(remote.data.storage).length, storage:remote.data.storage};
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'arkid-cloud-snapshot.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
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
