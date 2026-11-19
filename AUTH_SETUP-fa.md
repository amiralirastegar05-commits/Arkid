# راه‌اندازی حساب آرکید

رابط ورود در منوی کناری بازی از پروژه‌ی Supabase `arkid` با شناسه‌ی `kttefkhuchbufobdgdhi` استفاده می‌کند. آدرس Worker فعلی بازی `https://arkid-api.nova-197b21.workers.dev` است. پیشرفت، امتیاز و ذخیره‌های بازی همچنان محلی‌اند.

## تنظیمات Auth که مالک پروژه باید کامل کند

1. در **Authentication → URL Configuration**، Site URL را روی `https://amiralirastegar05-commits.github.io/Arkid/` بگذار و همین الگو را به Redirect URLs اضافه کن: `https://amiralirastegar05-commits.github.io/Arkid/**`.
2. Email provider در پروژه فعال است. Google provider فعلاً غیرفعال است؛ آن را در Supabase فعال کن و Google OAuth Client ID/Secret را فقط در داشبورد Supabase وارد کن. در Google Cloud، callback URIای را ثبت کن که Supabase در تنظیمات provider نشان می‌دهد.
3. برای ارسال ایمیل تأیید به بازیکنان، SMTP اختصاصی را در **Authentication → SMTP Settings** تنظیم کن. سرویس پیش‌فرض Supabase فقط برای اعضای سازمان ایمیل می‌فرستد و محدودیت ارسال پایینی دارد.

## جدول پروفایل

جدول `public.profiles` و ستون‌های `bio` و `avatar_path` همراه قید طول bio در پروژه‌ی `arkid` ساخته شده‌اند. مهاجرت‌های 001 تا 003 روی همین پروژه اعمال شده‌اند.

## Worker

Worker از قبل در آدرس بالا منتشر شده بود. سورس در `worker/wrangler.toml` به Project URL پروژه‌ی `arkid` اشاره می‌کند. برای اینکه Worker منتشرشده هم نشست‌های پروژه‌ی `arkid` را تأیید کند، باید همین URL در متغیر `SUPABASE_URL` و کلید عمومی پروژه در secret `SUPABASE_PUBLISHABLE_KEY` حساب Cloudflare ثبت شوند، سپس Worker دوباره منتشر شود:

```bash
npm install
npx wrangler login
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npm run deploy
```

برای Worker فقط کلید publishable تنظیم کن؛ هرگز `service_role` یا secret key را در مرورگر یا مخزن نگذار. فایل `cloud/arcade-auth.js` منبع فعلی تنظیمات عمومی کلاینت است.

## پشتیبان ابری اختیاری

پیشرفت به‌صورت خودکار همگام نمی‌شود. پس از بررسی و اجرای migrationهای 004 و 005 در محیط آزمایشی، از دکمه پشتیبان در حساب استفاده کن. برای بازیابی، پیش از باز کردن صفحه اصلی روی مرورگر خالی به `cloud/restore.html` برو. در صورت تعارض، داده‌ها خودکار ادغام یا بازنویسی نمی‌شوند. جزئیات ایمنی، نقشه داده، محدودیت‌ها و مراحل انتشار در `CLOUD_MIGRATION_AUDIT.md` است.
