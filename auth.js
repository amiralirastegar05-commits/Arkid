(() => {
  'use strict';

  const config = window.ARKID_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || '') &&
    /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabasePublishableKey || '');
  const workerUrl = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(config.workerUrl || '') &&
    !/YOUR_WORKER/i.test(config.workerUrl || '') ? config.workerUrl.replace(/\/$/, '') : '';
  const client = configured && window.supabase?.createClient
    ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
    : null;
  let session = null;
  let mode = 'signin';

  const esc = value => String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function setMenuState(user) {
    const label = document.querySelector('#arkidAccountButton .arkid-account-state');
    if (label) label.textContent = user?.email || (configured ? 'ورود / ثبت‌نام' : 'نیاز به پیکربندی');
    const button = document.getElementById('arkidAccountButton');
    if (button) button.setAttribute('aria-label', user ? `حساب ${user.email}` : 'ورود یا ساخت حساب آرکید');
  }

  function setStatus(message, kind = '') {
    const status = document.getElementById('arkidAuthStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function setBusy(busy) {
    document.querySelectorAll('#arkidAuthDialog button').forEach(button => {
      if (button.dataset.keepEnabled !== 'true') button.disabled = busy;
    });
    const submit = document.getElementById('arkidAuthSubmit');
    if (submit) submit.textContent = busy ? 'در حال انجام…' : (mode === 'signup' ? 'ساخت حساب' : 'ورود به حساب');
  }

  function render() {
    const dialog = document.getElementById('arkidAuthDialog');
    if (!dialog) return;
    const title = session ? 'حساب آرکید' : (mode === 'signup' ? 'ساخت حساب آرکید' : 'ورود به آرکید');
    const body = session ? `
      <div class="arkid-auth-account"><strong>${esc(session.user?.user_metadata?.name || session.user?.user_metadata?.full_name || 'بازیکن آرکید')}</strong><small dir="ltr">${esc(session.user?.email)}</small></div>
      <p class="arkid-auth-note">ورود شما فعال است. پیشرفت بازی در این فاز همچنان فقط روی همین مرورگر ذخیره می‌شود.</p>
      <div id="arkidWorkerCheck" class="arkid-auth-check" data-state="pending">در حال بررسی API آرکید…</div>
      <div class="arkid-auth-actions"><button class="arkid-auth-btn" id="arkidSignOut" type="button">خروج از حساب</button></div>
      <p id="arkidAuthStatus" class="arkid-auth-status" role="status" aria-live="polite"></p>` : `
      <p class="arkid-auth-copy">${mode === 'signup' ? 'با ایمیل و گذرواژه حساب بساز؛ ممکن است لازم باشد ایمیلت را تأیید کنی.' : 'با ایمیل و گذرواژه وارد شو یا از ورود گوگل استفاده کن.'}</p>
      <form class="arkid-auth-form" id="arkidAuthForm">
        ${mode === 'signup' ? '<label>نام نمایشی<input name="displayName" type="text" maxlength="40" autocomplete="nickname" required></label>' : ''}
        <label>ایمیل<input name="email" type="email" autocomplete="email" required></label>
        <label>گذرواژه<input name="password" type="password" minlength="8" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required></label>
        <div class="arkid-auth-actions"><button class="arkid-auth-btn primary" id="arkidAuthSubmit" type="submit">${mode === 'signup' ? 'ساخت حساب' : 'ورود به حساب'}</button>
        <button class="arkid-auth-btn" id="arkidGoogleSignIn" type="button">ادامه با Google</button></div>
      </form>
      <p id="arkidAuthStatus" class="arkid-auth-status" role="status" aria-live="polite"></p>
      ${configured ? '' : '<p class="arkid-auth-note">برای فعال شدن ورود، نشانی پروژه و کلید publishable را در <code>auth-config.js</code> وارد کن. این فایل فقط کلید عمومی را می‌پذیرد.</p>'}
      <button class="arkid-auth-toggle" id="arkidAuthToggle" type="button">${mode === 'signup' ? 'از قبل حساب داری؟ ورود' : 'حساب نداری؟ ثبت‌نام'}</button>`;
    dialog.innerHTML = `<section class="arkid-auth"><header class="arkid-auth-head"><h2 id="arkidAuthTitle">${title}</h2><button class="arkid-auth-close" id="arkidAuthClose" type="button" aria-label="بستن">✕</button></header>${body}</section>`;

    document.getElementById('arkidAuthClose').addEventListener('click', () => dialog.close());
    document.getElementById('arkidAuthToggle')?.addEventListener('click', () => {
      mode = mode === 'signup' ? 'signin' : 'signup';
      render();
    });
    document.getElementById('arkidAuthForm')?.addEventListener('submit', submitEmailForm);
    document.getElementById('arkidGoogleSignIn')?.addEventListener('click', signInWithGoogle);
    document.getElementById('arkidSignOut')?.addEventListener('click', signOut);
    setBusy(false);
    if (session) checkWorker();
  }

  async function submitEmailForm(event) {
    event.preventDefault();
    if (!client) return setStatus('ورود هنوز پیکربندی نشده است.', 'error');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    setBusy(true);
    setStatus(mode === 'signup' ? 'در حال ساخت حساب…' : 'در حال ورود…');
    try {
      let result;
      if (mode === 'signup') {
        const displayName = String(form.get('displayName') || '').trim();
        result = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.href.split('#')[0],
            data: { name: displayName }
          }
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          session = result.data.session;
          setMenuState(session.user);
          render();
          return setStatus('حساب ساخته شد و وارد شدی.', 'success');
        }
        setStatus('حساب ساخته شد. لینک تأیید را از ایمیلت باز کن، سپس وارد شو.', 'success');
      } else {
        result = await client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        session = result.data.session;
        setMenuState(session?.user);
        render();
        setStatus('با موفقیت وارد شدی.', 'success');
      }
    } catch (error) {
      setStatus(error?.message || 'انجام عملیات ممکن نشد. دوباره تلاش کن.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!client) return setStatus('ورود هنوز پیکربندی نشده است.', 'error');
    setBusy(true);
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href.split('#')[0] }
      });
      if (error) throw error;
    } catch (error) {
      setStatus(error?.message || 'ورود با Google انجام نشد.', 'error');
      setBusy(false);
    }
  }

  async function signOut() {
    if (!client) return;
    setBusy(true);
    const { error } = await client.auth.signOut();
    if (error) {
      setBusy(false);
      return setStatus(error.message, 'error');
    }
    session = null;
    setMenuState(null);
    mode = 'signin';
    render();
    setStatus('از حساب خارج شدی.', 'success');
  }

  async function checkWorker() {
    const check = document.getElementById('arkidWorkerCheck');
    if (!check) return;
    if (!workerUrl) {
      check.textContent = 'API آرکید هنوز آدرس‌دهی نشده است.';
      check.dataset.state = 'pending';
      return;
    }
    try {
      const response = await fetch(`${workerUrl}/v1/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const identity = await response.json();
        check.textContent = identity.id === session.user.id ? 'اتصال حساب و API برقرار است.' : 'شناسه حساب با API مطابقت ندارد.';
        check.dataset.state = identity.id === session.user.id ? 'ok' : 'bad';
      } else {
        check.textContent = response.status === 503 ? 'تنظیمات Worker کامل نیست.' : 'API نتوانست نشست این کاربر را تأیید کند.';
        check.dataset.state = 'bad';
      }
    } catch (_) {
      check.textContent = 'API در دسترس نیست یا تنظیمات CORS کامل نشده است.';
      check.dataset.state = 'bad';
    }
  }

  function openDialog() {
    const dialog = document.getElementById('arkidAuthDialog');
    if (!dialog.open) {
      render();
      dialog.showModal();
      document.getElementById('arkidAuthClose').focus();
    }
  }

  function init() {
    const sideMenu = document.querySelector('.side-menu-panel');
    const profileButton = sideMenu?.querySelector('[data-action="profile"]');
    if (!sideMenu || !profileButton || document.getElementById('arkidAccountButton')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sm-item';
    button.id = 'arkidAccountButton';
    button.innerHTML = '<span aria-hidden="true">🔐</span><span>حساب آرکید</span><span class="arkid-account-state"></span>';
    profileButton.after(button);
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (typeof window.closeSideMenu === 'function') window.closeSideMenu();
      openDialog();
    });

    const dialog = document.createElement('dialog');
    dialog.id = 'arkidAuthDialog';
    dialog.setAttribute('aria-labelledby', 'arkidAuthTitle');
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    document.body.append(dialog);
    setMenuState(null);

    if (!configured) return;
    client.auth.getSession().then(({ data, error }) => {
      if (error) setStatus(error.message, 'error');
      session = data?.session || null;
      setMenuState(session?.user);
    });
    client.auth.onAuthStateChange((event, nextSession) => {
      session = nextSession;
      setMenuState(session?.user);
      if (event === 'SIGNED_IN' && document.getElementById('arkidAuthDialog')?.open) render();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
