import './messages.js';
import {currentUser, readOwnProfile, saveOwnProfile} from './public-profile.js';

const $ = id => document.getElementById(id);
const login = $('login'), form = $('profileForm'), status = $('status');
const name = $('displayName'), bio = $('bio'), visibility = $('visibility');
let auth, userId, existing = null, busy = true, accountLabel = '';
const say = (text, kind = '') => { status.textContent = text; status.dataset.kind = kind; };
function setBusy(value) {
  busy = value;
  document.querySelectorAll('#login input, #login button, #profileForm input, #profileForm textarea, #profileForm button').forEach(el => { el.disabled = value; });
}
function errorMessage(error, context = '') {
  const raw = String(error?.message || '');
  if (raw === 'invalid_name') return 'یک نام نمایشی بین ۱ تا ۴۰ نویسه وارد کن.';
  if (raw === 'invalid_bio') return 'بیوگرافی باید حداکثر ۱۶۰ نویسه باشد.';
  if (raw === 'stale_profile') return 'پروفایل از جای دیگری تغییر کرده است. تغییرات فعلی‌ات را نگه دار، سپس پروفایل را دوباره دریافت کن.';
  if (raw === 'account_changed' || raw === 'sign_in_required') return 'حساب تغییر کرده یا نشست پایان یافته است. اطلاعات نوشته‌شده را نگه دار و دوباره وارد شو.';
  if (error?.code === 'PGRST205' || error?.code === '42P01') return 'پروفایل اجتماعی هنوز برای حساب‌ها فعال نشده است. کمی بعد دوباره تلاش کن.';
  if (context === 'save') return 'ذخیره تأیید نشد؛ ممکن است انجام شده باشد. اطلاعات نوشته‌شده را نگه دار و بعد از بررسی دوباره تلاش کن.';
  return globalThis.ArkidMessages.message(error, 'login');
}
function hasDraft() {
  return name.value !== (existing?.display_name || '') || bio.value !== (existing?.bio || '') || visibility.checked !== (existing?.is_public || false);
}
async function load() {
  const client = auth.getClient();
  const id = await currentUser(client);
  const row = await readOwnProfile(client,id);
  userId = id;
  existing = row;
  name.value = row?.display_name || '';
  bio.value = row?.bio || '';
  visibility.checked = row?.is_public || false;
  $('accountEmail').textContent = accountLabel;
  login.hidden = true;
  form.hidden = false;
  say(row ? 'پروفایلت آماده است؛ می‌توانی آن را ویرایش کنی.' : 'نام و بیوگرافی‌ات را وارد کن؛ نمایش عمومی به انتخاب توست.');
}
login.addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !auth) return;
  const fields = new FormData(login);
  setBusy(true); say('در حال ورود…');
  try {
    const {data,error} = await auth.signIn(String(fields.get('email') || '').trim(),fields.get('password'));
    if (error) throw error;
    accountLabel = data?.session?.user?.email || '';
    login.reset();
    await load();
  } catch (error) { say(errorMessage(error), 'error'); }
  finally { setBusy(false); }
});
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !userId) return;
  const input = {name:name.value, bio:bio.value, isPublic:visibility.checked};
  setBusy(true); say('در حال ذخیره…');
  try {
    existing = await saveOwnProfile(auth.getClient(), userId, existing, input);
    name.value = existing.display_name; bio.value = existing.bio; visibility.checked = existing.is_public;
    say(existing.is_public ? 'پروفایل ذخیره شد و برای بازیکنان واردشده قابل نمایش است.' : 'پروفایل ذخیره شد و فقط برای خودت قابل نمایش است.', 'success');
  } catch (error) { say(errorMessage(error,'save'), 'error'); }
  finally { setBusy(false); }
});
$('reload').addEventListener('click', async () => {
  if (busy || (hasDraft() && !confirm('تغییرات ذخیره‌نشده با نسخهٔ ذخیره‌شده جایگزین می‌شوند. ادامه می‌دهی؟'))) return;
  setBusy(true); say('در حال دریافت…');
  try { await load(); } catch (error) { say(errorMessage(error), 'error'); } finally { setBusy(false); }
});
$('signout').addEventListener('click', async () => {
  if (busy || (hasDraft() && !confirm('تغییرات ذخیره‌نشده از این صفحه کنار گذاشته می‌شوند. ادامه می‌دهی؟'))) return;
  setBusy(true);
  try {
    const {error} = await auth.signOut(); if (error) throw error;
    userId = null; existing = null; accountLabel = '';
    form.reset(); form.hidden = true; login.hidden = false;
    say('برای ویرایش پروفایل وارد حسابت شو.');
  } catch (error) { say(errorMessage(error), 'error'); }
  finally { setBusy(false); }
});
setBusy(true);
try {
  await import('./arcade-auth.js'); auth = window.ArkidAuth;
  const {data,error} = await auth.getSession(); if (error) throw error;
  if (data?.session?.user?.id) { accountLabel = data.session.user.email || ''; await load(); }
  else say('برای ساخت پروفایل وارد حسابت شو.');
  setBusy(false);
} catch (error) { say(errorMessage(error), 'error'); }
