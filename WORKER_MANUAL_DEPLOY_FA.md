# راه سادهٔ انتشار دستی Worker جدید Arkid

> وضعیت شاخهٔ اجتماعی فعلی: متن زیر راهنمای تاریخی راه‌اندازی Worker قبلی آرکید است، نه دستور فعال‌کردن مسابقه. نسخهٔ تازهٔ `worker/dashboard-worker.js` قابلیت مسابقه را فقط پشت `RANKED_ENABLED` و یک secret صرفاً سروری `RANKED_SERVICE_KEY` دارد و به‌صورت پیش‌فرض خاموش است. هیچ کلید محرمانه‌ای در فایل تولیدشده، Frontend، مخزن یا گفتگو قرار نمی‌گیرد. پیش از هر Deploy یا فعال‌سازی، migrationهای اجتماعی، جداسازی دسترسی، تست محیط آزمایشی واقعی، نگهداری امن secret و بررسی امنیت باید تأیید شوند؛ صرفاً کپی‌کردن این فایل مسابقه را فعال نمی‌کند. وضعیت جاری و محدودیت‌ها را در `SOCIAL_PHASE1_FA.md` ببینید.

این راهنما **برای یک Worker جدید و مستقل** است؛ Worker قبلی را باز یا ویرایش نکنید. کاربر Worker جدید `arkid-api-now` را Deploy کرده و پاسخ `/health` آن مشاهده شده است. مراحل ساخت زیر برای مراجعات بعدی است؛ Worker موجود را دوباره Deploy نکنید مگر تغییر جدیدی لازم باشد.

## ۱. ساخت Worker جدید

1. وارد [Cloudflare Dashboard](https://dash.cloudflare.com/) شوید و از حساب خودتان به **Workers & Pages** بروید.
2. فهرست Workerها را بررسی کنید. اگر `arkid-api-new` از قبل وجود دارد، آن را بازنویسی نکنید؛ نام جدید و یکتای دیگری انتخاب کنید.
3. **Create application → Hello World** را انتخاب کنید، نام جدید را وارد و Worker تازه را Deploy کنید. ممکن است ظاهر یا نام بعضی دکمه‌ها در Dashboard کمی متفاوت باشد. اگر درخواست ساخت زیردامنهٔ `workers.dev` شد، مراحل خود Cloudflare را دنبال کنید.

## ۲. قرار دادن کد آماده

1. وارد **همان Worker تازه** شوید و **Edit code** را بزنید.
2. [فایل کامل Worker آماده در همین شاخهٔ GitHub](https://github.com/amiralirastegar05-commits/Arkid/blob/arena/22234c77-arkid/worker/dashboard-worker.js) را باز و همهٔ متن آن را کپی کنید. اگر در GitHub دکمهٔ کپی دیدید، از آن استفاده کنید.
3. فقط متن نمونهٔ Hello World را در ویرایشگر Worker تازه با کد کپی‌شده جایگزین کنید و **Deploy** را بزنید.
4. نسخهٔ منتشرشدهٔ اولیه برای `/health` و `/v1/me` فقط تنظیمات عمومی لازم داشت. فایل جدید شاخه نیز فقط تنظیمات عمومی را داخل کد دارد؛ اما حالت مسابقه‌ای جدید در صورت فعال‌سازی جداگانه به Secret سروری نیاز خواهد داشت. آن Secret هرگز داخل فایل، Frontend یا گفتگو قرار نمی‌گیرد. پیکربندی عمومی از `worker/wrangler.toml` گرفته می‌شود و bundle با `node worker/scripts/build-dashboard.mjs` بازتولید می‌شود؛ فعال‌سازی مسابقه مراحل امنیتی و بررسی مجزا دارد.

## ۳. تأیید اولیه و ارسال آدرس

1. در صفحهٔ Worker، آدرس `workers.dev` مربوط به همین Worker جدید را پیدا کنید.
2. در مرورگر آدرس Worker را با `/health` در انتها باز کنید. خروجی مورد انتظار شامل `ok: true`، `service: arkid-api` و `version: 1` است. این فقط سلامت اولیه را نشان می‌دهد، نه صحت ورود کاربر.
3. **فقط آدرس پایهٔ Worker جدید** را در گفتگو بفرستید (بدون `/health`). رمز، Secret، توکن یا کلید خصوصی نفرستید. بعد از دریافت آدرس، باید CORS و احراز هویت بررسی و نشانی Worker در `cloud/config.js` تنظیم شود.

## ۴. تنظیم Auth برای GitHub Pages

این مرحله به حساب شما و تصمیم دربارهٔ آدرس انتشار نیاز دارد؛ در این نوبت تنظیمات Supabase تغییر نکرده است.

1. به [Supabase → Authentication → URL Configuration پروژهٔ جدید](https://supabase.com/dashboard/project/xorsueznslmcmkfqizqn/auth/url-configuration) بروید و شناسهٔ پروژه را چک کنید.
2. برای سایت منتشرشدهٔ کنونی، **Site URL** پیشنهادی این است:
   `https://amiralirastegar05-commits.github.io/Arkid/`
3. در **Redirect URLs** این آدرس‌های دقیق را اضافه یا بررسی کنید، بدون حذف دیگر آدرس‌های مجاز موجود:
   - `https://amiralirastegar05-commits.github.io/Arkid/`
   - `https://amiralirastegar05-commits.github.io/Arkid/index.html`
   - `https://amiralirastegar05-commits.github.io/Arkid/cloud/restore.html`
4. تنظیمات را ذخیره کنید. تأیید ایمیل، ارسال ایمیل و بازگشت به سایت هنوز باید با حساب آزمایشی بررسی شوند. Google در پروژه غیرفعال است و در رابط هم پنهان مانده؛ فعال‌سازی آن مراحل جداگانه دارد.

## پیش از انتشار سایت

PR شمارهٔ ۲ در آخرین بررسی پیش‌نویس و بدون تعارض بود، اما چک خودکار GitHub برای آن گزارش نشده بود. ادغام آن به `cloud-integration-phase1` می‌تواند GitHub Pages را خودکار منتشر کند. نشانی Worker جدید در Frontend این شاخه تنظیم شده، ولی CORS و احراز هویت واقعی، تنظیم Auth و پشتیبان/بازیابی سرتاسری هنوز تأیید نشده‌اند. داده یا binding محلی قدیمی را پاک نکنید. نسخهٔ منتشرشدهٔ فعلی هنوز با شاخهٔ جدید یکسان نیست.

منابع: [Cloudflare Dashboard](https://developers.cloudflare.com/workers/get-started/dashboard/)، [ویرایش و Deploy](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/)، [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
