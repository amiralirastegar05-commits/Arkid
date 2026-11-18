# راه‌اندازی حساب آرکید

رابط ورود در منوی کناری بازی اضافه شده است و از اتصال موجود شاخه‌ی `cloud-integration-phase1` استفاده می‌کند: پروژه‌ی Supabase با شناسه‌ی `uirtfghcpzevedvbaekj` و Worker با آدرس `https://arkid-api.nova-197b21.workers.dev`. بررسی فقط‌خواندنی Worker نشان داد `/health` پاسخ 200 می‌دهد و `/v1/me` نشست نامعتبر را با 401 رد می‌کند. پیشرفت، امتیاز و ذخیره‌های بازی همچنان محلی‌اند.

## تنظیمات Auth که مالک پروژه باید کامل کند

1. در **Authentication → URL Configuration**، Site URL را روی `https://amiralirastegar05-commits.github.io/Arkid/` بگذار و همین الگو را به Redirect URLs اضافه کن: `https://amiralirastegar05-commits.github.io/Arkid/**`.
2. Email provider در پروژه فعال است. Google provider فعلاً غیرفعال است؛ آن را در Supabase فعال کن و Google OAuth Client ID/Secret را فقط در داشبورد Supabase وارد کن. در Google Cloud، callback URIای را ثبت کن که Supabase در تنظیمات provider نشان می‌دهد.
3. برای ارسال ایمیل تأیید به بازیکنان، SMTP اختصاصی را در **Authentication → SMTP Settings** تنظیم کن. سرویس پیش‌فرض Supabase فقط برای اعضای سازمان ایمیل می‌فرستد و محدودیت ارسال پایینی دارد.

## به‌روزرسانی جدول پروفایل

جدول `public.profiles` از قبل در پروژه موجود است؛ درخواست فقط‌خواندنی از Data API نشان داد دو ستون `bio` و `avatar_path` در آن نیستند. مالک پروژه باید فایل `supabase/migrations/003_profiles_extend_existing.sql` را در SQL Editor اجرا کند. این فایل فقط ستون‌های مفقود و قید طول bio را اضافه می‌کند. دسترسی فعلی Supabase به این پروژه اجازه‌ی اعمال migration از راه دور نداد.

## Worker

Worker از قبل منتشر شده است. پیکربندی سورس در `worker/wrangler.toml` به همان Project URL اشاره می‌کند. برای انتشار دوباره از پوشه‌ی `worker`، Wrangler و دسترسی Cloudflare لازم است:

```bash
npm install
npx wrangler login
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npm run deploy
```

برای Worker فقط کلید publishable تنظیم کن؛ هرگز `service_role` یا secret key را در مرورگر یا مخزن نگذار. فایل `cloud/arcade-auth.js` منبع فعلی تنظیمات عمومی کلاینت است.
