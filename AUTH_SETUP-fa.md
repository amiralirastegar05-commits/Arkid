# راه‌اندازی ورود آرکید

رابط حساب در منوی کناری آرکید قرار دارد. این راهنما اتصال Supabase Auth، جدول پروفایل و API بررسی نشست را کامل می‌کند. پیشرفت بازی، امتیاز و ذخیره‌های فعلی در این مرحله به حساب ابری منتقل نمی‌شوند.

## ۱. تنظیم Supabase

پروژه‌ی Supabase با نام `arkid` در سازمان متصل ساخته شده و migrationهای پروفایل اعمال شده‌اند. URL و Publishable key هم در `auth-config.js` ثبت شده‌اند. وضعیت کلیدها از مسیر **Project Settings → API** قابل بازبینی است؛ کلید `service_role` یا secret key را در سایت قرار نده.

1. در **Authentication → URL Configuration**، Site URL را روی `https://amiralirastegar05-commits.github.io/Arkid/` بگذار و این آدرس را به Redirect URLs اضافه کن:
   `https://amiralirastegar05-commits.github.io/Arkid/**`
2. Email provider را فعال نگه دار. برای ورود Google، Google provider را در Supabase فعال کن و Client ID/Secret را فقط در داشبورد Supabase وارد کن. در Google Cloud OAuth Client، callback URI را دقیقاً برابر آدرس callbackای بگذار که Supabase در تنظیمات Google نشان می‌دهد.
3. برای ارسال ایمیل تأیید به بازیکنان، SMTP اختصاصی را در **Authentication → SMTP Settings** تنظیم کن. سرویس پیش‌فرض Supabase فقط به اعضای سازمان ایمیل می‌فرستد و محدودیت ارسال پایینی دارد؛ برای کاربران واقعی کافی نیست.

## ۲. انتشار Worker

1. در `worker/wrangler.toml` مقدار `SUPABASE_URL` را با Project URL همان پروژه جایگزین کن. `ALLOWED_ORIGINS` باید فقط origin باشد؛ مقدار پیش‌فرض مخزن برای GitHub Pages همین است.
2. از پوشه `worker` اجرا کن:

   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
   npm run deploy
   ```

   هنگام درخواست secret، مقدار publishable key را وارد کن. این کلید مجاز است در مرورگر و Worker استفاده شود؛ secret/service_role را وارد نکن.
3. آدرس Worker منتشرشده را در `workerUrl` در `auth-config.js` بگذار؛ برای نمونه `https://arkid-api.example.workers.dev`.

## ۳. رفتار برنامه

- حساب با ایمیل و گذرواژه ساخته می‌شود. اگر تأیید ایمیل در Supabase فعال باشد، کاربر باید لینک ایمیل را باز کند.
- ورود Google از همان صفحه به Supabase منتقل می‌شود و پس از ورود به مسیر GitHub Pages آرکید برمی‌گردد.
- ساخت Auth user به‌طور خودکار ردیف `profiles` می‌سازد. Worker هم نشست Supabase را در `/v1/me` بررسی می‌کند.
- برای اجرای محلی، آدرس صفحه باید در Supabase Redirect URLs و origin آن در `ALLOWED_ORIGINS` ثبت شود.
