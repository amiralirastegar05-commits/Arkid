// User-facing messages must never expose raw server errors or credentials.
(function (root) {
  'use strict';
  function message(error, context = 'general') {
    const code = String(error?.code || '').toLowerCase();
    const raw = String(error?.message || '').toLowerCase();
    if (raw.includes('rollback was incomplete')) return 'بازیابی کامل نشد و ممکن است بخشی از داده‌ها در این مرورگر باقی مانده باشد. چیزی را پاک نکن و برای بررسی کمک بگیر.';
    if (raw.includes('local game data already exists')) return 'این مرورگر از قبل پیشرفت بازی دارد. برای محافظت از آن، بازیابی متوقف شد. از یک مرورگر تازه استفاده کن؛ هیچ داده‌ای پاک نشده است.';
    if (raw.includes('game session is active')) return 'ابتدا بازی‌های باز را ببند و دوباره تلاش کن.';
    if (raw.includes('local data changed during restore') || raw.includes('local cloud binding changed')) return 'اطلاعات این مرورگر هنگام انجام کار تغییر کرد. برگه‌های دیگر آرکید را ببند و دوباره تلاش کن.';
    if (raw.includes('linked to a different account') || raw.includes('linked to another account')) return 'این مرورگر به حساب دیگری متصل است. برای حفظ پیشرفت فعلی، از مرورگر دیگری استفاده کن.';
    if (raw.includes('another or unknown project') || raw.includes('invalid local cloud metadata')) return 'اطلاعات پشتیبان این مرورگر نیاز به بررسی دارد. برای حفظ پیشرفت، چیزی را پاک نکن.';
    if (raw.includes('cloud conflict') || raw.includes('snapshot conflict')) return 'پیشرفت این مرورگر با پشتیبان ابری متفاوت است. برای جلوگیری از از دست رفتن اطلاعات، هیچ‌کدام بازنویسی نشدند.';
    if (raw.includes('snapshot history full')) return 'فضای نسخه‌های پشتیبان پر شده است. پیشرفت فعلی را نگه دار و برای بررسی کمک بگیر.';
    if (raw.includes('no local game data')) return 'هنوز پیشرفتی در این مرورگر برای پشتیبان‌گیری پیدا نشد.';
    if (raw.includes('cloud snapshot is missing') || raw.includes('پشتیبان ابری پیدا نشد')) return 'برای این حساب پشتیبان ابری پیدا نشد. ابتدا در مرورگری که پیشرفتت در آن است پشتیبان بگیر.';
    if (raw.includes('account changed')) return 'حساب در حین انجام کار تغییر کرد. دوباره وارد حساب درست شو و تلاش کن.';
    if (raw.includes('snapshot is too large')) return 'حجم پیشرفت برای پشتیبان‌گیری بیش از حد مجاز است. اطلاعاتت را نگه دار و برای بررسی کمک بگیر.';
    if (code === 'invalid_credentials' || raw.includes('invalid login credentials')) return 'ایمیل یا گذرواژه درست نیست. دوباره بررسی کن.';
    if (code === 'email_not_confirmed' || raw.includes('email not confirmed')) return 'هنوز ایمیلت تأیید نشده است. لینک تأیید را در ایمیلت باز کن.';
    if (code.includes('rate_limit') || error?.status === 429 || raw.includes('rate limit')) return 'تعداد تلاش‌ها زیاد بوده است. کمی صبر کن و دوباره تلاش کن.';
    if (code === 'user_already_exists' || raw.includes('user already registered')) return 'برای این ایمیل ممکن است حسابی وجود داشته باشد. ورود به حساب را امتحان کن.';
    if (raw.includes('password') && (raw.includes('weak') || raw.includes('at least'))) return 'گذرواژه پذیرفته نشد. گذرواژه‌ای قوی‌تر انتخاب کن.';
    if (context === 'upload') return 'ذخیرهٔ پشتیبان تأیید نشد؛ ممکن است در ابر ذخیره شده باشد. پیشرفت این مرورگر را نگه دار و پس از بررسی دوباره تلاش کن.';
    if (context === 'restore') return 'بازیابی انجام نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن؛ پیشرفت فعلی را پاک نکن.';
    if (context === 'download') return 'دریافت پشتیبان انجام نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن.';
    return 'این کار انجام نشد. اتصال اینترنت و اطلاعات ورود را بررسی کن و دوباره تلاش کن.';
  }
  root.ArkidMessages = Object.freeze({ message });
})(globalThis);
