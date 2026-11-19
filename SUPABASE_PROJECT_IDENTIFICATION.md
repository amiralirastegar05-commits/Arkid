# شناسایی پروژهٔ Supabase آرکید — بررسی فقط‌خواندنی

**تاریخ بررسی:** ۲۰۲۶-۱۱-۱۹، حدود ۱۰:۵۵ UTC
**مخزن:** `amiralirastegar05-commits/Arkid`
**شاخهٔ گزارش:** `arena/22234c77-arkid`، بر پایهٔ `083117de9121e31a8bee325527892e274cc12bf4` از `cloud-integration-phase1`.

## نتیجهٔ اصلی

**پروژهٔ اصلی Arkid هنوز نامشخص است.** با اطمینان زیاد می‌توان گفت کد فعلی Frontend و پیکربندیِ ثبت‌شدهٔ Worker به `kttefkhuchbufobdgdhi` اشاره دارند. همچنین با اطمینان زیاد می‌توان گفت `uirtfghcpzevedvbaekj` پروژه‌ای به نام `Arkid` در اتصال فعلی است و در بخشی از تاریخچهٔ کد استفاده شده است. این شواهد تعیین نمی‌کنند مالک، کدام پروژه را اکنون پروژهٔ اصلی یا آزمایشی می‌داند. هیچ‌یک را بدون تأیید مالک اصلی یا آزمایشی اعلام نمی‌کنیم.

فهرست پروژه‌های اتصال فعلی فقط `uirtfghcpzevedvbaekj` را نشان داد؛ `kttefkhuchbufobdgdhi` در این فهرست نبود. بنابراین Schema، Migrationها، شمارش داده‌ها و تنظیمات Auth پروژهٔ `ktte...` را نتوانستیم از طریق این اتصال بررسی کنیم. نبودن در فهرست به معنی حذف‌شدن، غیرفعال‌بودن یا آزمایشی‌بودن آن نیست.

## مقایسهٔ دو شناسه

| مورد | `kttefkhuchbufobdgdhi` | `uirtfghcpzevedvbaekj` |
| --- | --- | --- |
| ارتباط با کد | هدف فعلی `cloud/arcade-auth.js` و `worker/wrangler.toml` در نسخهٔ بررسی‌شده. Frontend برای Auth و Snapshot مستقیماً از پروژهٔ پیکربندی‌شده استفاده می‌کند؛ Worker کدش نشانی `auth/v1/user` را از متغیر محیطی خود می‌سازد. | هدف پیشین Frontend و Worker در commitهای مشخص Git؛ پروژهٔ متصل فعلی با نام `Arkid`. |
| دسترسی زنده | در `list_projects` اتصال فعلی دیده نشد؛ Schema و داده‌های زنده بررسی نشدند. | در اتصال دیده شد؛ نام `Arkid`، وضعیت `ACTIVE_HEALTHY`، منطقهٔ `ap-southeast-2` و PostgreSQL 17.12 گزارش شد. |
| Schema و Migration | نامشخص؛ ادعای سابق فایل راهنما دربارهٔ اعمال Migrationهای 001–003 مستقل از دیتابیس تأیید نشد. | جدول `public.profiles` موجود است ولی با Schema فعلی مخزن تفاوت دارد؛ فهرست تاریخچهٔ Migration خالی و اجزای Snapshot 004 غایب بودند. جزئیات پایین آمده است. |
| شواهد استفاده | GitHub Pages طبق API از `cloud-integration-phase1` منتشر می‌شود و آخرین build مشاهده‌شده برای commit `083117...` بود؛ کد آن commit به این Ref اشاره می‌کند. این شواهد استفادهٔ واقعی، موفقیت ورود، وجود داده، نسخهٔ Cache مرورگر یا تنظیمات منتشرشدهٔ Worker را ثابت نمی‌کند. | در زمان شمارش، `auth.users = 0`، `public.profiles = 0` و `auth.identities = 0` بودند. صرف صفر بودن، ثابت نمی‌کند پروژه آزمایشی است یا داده‌ها هرگز وجود نداشته‌اند. |
| نتیجه | **نامشخص** از نظر اصلی/آزمایشی؛ هدف ثبت‌شدهٔ فعلی کد. | **نامشخص** از نظر اصلی/آزمایشی؛ پروژهٔ متصل و هدف پیشین کد. |

## شواهد دقیق تاریخچه و تنظیمات کد

به‌دلیل shallow بودن checkout محلی، تاریخچهٔ مسیرها با GitHub API به‌صورت خواندنی بررسی شد؛ فقط Refها و متادیتای commit استخراج شد، نه کلیدها.

1. در commit [`f1957aa9b8292136fc1febca9d96df66543dab8c`](https://github.com/amiralirastegar05-commits/Arkid/commit/f1957aa9b8292136fc1febca9d96df66543dab8c) مورخ ۲۰۲۶-۱۱-۱۸ ۱۸:۳۸ UTC، `cloud/arcade-auth.js` به `uirtfghcpzevedvbaekj` اشاره می‌کرد.
2. در commit [`d57c1298e99d76415826f8f8050d2a1c375638d8`](https://github.com/amiralirastegar05-commits/Arkid/commit/d57c1298e99d76415826f8f8050d2a1c375638d8) مورخ ۱۹:۱۳ UTC، `worker/wrangler.toml` به `kttefkhuchbufobdgdhi` اشاره می‌کرد. در commit [`57230208e1d0dc67dc8fedd636051deeb43867ef`](https://github.com/amiralirastegar05-commits/Arkid/commit/57230208e1d0dc67dc8fedd636051deeb43867ef) مورخ ۱۹:۴۲ UTC، هم ماژول Frontend و هم تنظیم Worker به `uirtfghcpzevedvbaekj` اشاره می‌کردند.
3. commit [`4b625d01d9fceeb6367ca25adf43fdea016d9049`](https://github.com/amiralirastegar05-commits/Arkid/commit/4b625d01d9fceeb6367ca25adf43fdea016d9049) مورخ ۲۰:۰۰ UTC با عنوان `Connect Arkid auth to Arkid Supabase project` مقدار URL را در هر دو فایل از `uirt...` به `ktte...` تغییر داد. خود commit دلیل مالکیتی تغییر یا وضعیت واقعی هر پروژه را اثبات نمی‌کند.
4. نسخهٔ مبنای فعلی `083117de9121e31a8bee325527892e274cc12bf4` همچنان `ktte...` را در هر دو فایل دارد. مقدار `SUPABASE_URL` واقعی Worker منتشرشده، و اعتبار نشست‌های آن، در این بررسی مشاهده نشده است. فایل Worker همچنین origin سایت GitHub Pages را در allowlist ثبت کرده است؛ این مقدارِ مخزن لزوماً برابر پیکربندی منتشرشده نیست.
5. `AUTH_SETUP-fa.md` هدف فعلی را `ktte...` معرفی و دربارهٔ Auth/Migrationهای آن ادعاهایی تاریخی می‌کند؛ بدون دسترسی به خود پروژه، این ادعاها به‌عنوان وضعیت زنده تأیید نمی‌شوند.

## Schema، Migration و Auth پروژهٔ قابل‌دسترسی `uirt...`

در این نوبت فقط پرس‌وجوهای `SELECT` روی catalogها و شمارش‌های تجمعی اجرا شد. هیچ رکورد شخصی، محتوای کاربر، کلید یا اطلاعات محرمانه در گزارش درج نشده است.

- تنها جدول پایهٔ مشاهده‌شده در `public`، `profiles` بود. ستون‌ها: `id`، `username`، `display_name`، `avatar_url`، `created_at` و `updated_at`. ستون‌های `bio` و `avatar_path` وجود نداشتند. `id` کلید اصلی و دارای foreign key به `auth.users` با `ON DELETE CASCADE` است؛ `username` یک قید UNIQUE معمولی دارد.
- RLS برای `profiles` فعال بود و FORCE RLS فعال نبود. Policy خواندن با نام `Profiles are viewable by authenticated users` شرط `true` برای کاربران authenticated دارد؛ policy ویرایش `Users can update their own profile` محدود به `auth.uid() = id` است. وضعیت کامل مجوزها و همهٔ نقش‌های مؤثر در این نوبت آزمایش نشده است.
- توابع public مشاهده‌شده `handle_new_user()` و `update_updated_at()` بودند. Triggerهای `on_auth_user_created` روی درج در `auth.users` و `profiles_updated_at` روی ویرایش `profiles` دیده شدند. آن‌ها از نظر عملکرد با ساخت حساب واقعی آزمایش نشدند.
- جدول‌های `arkid_cloud_snapshots` و `arkid_cloud_snapshot_history` و تابع `arkid_save_snapshot(uuid,uuid,jsonb)` در catalog پیدا نشدند. فهرست Edge Functionها خالی بود؛ این مورد جدا از توابع SQL است.
- `list_migrations` فهرست خالی برگرداند. این فقط وضعیت تاریخچهٔ ثبت‌شده را نشان می‌دهد و اثبات نمی‌کند هیچ SQL دستی قبلاً اجرا نشده است. وجود جدول و Trigger نشان می‌دهد دست‌کم بخشی از زیرساخت پروفایل موجود است، ولی با Migrationهای مخزن یکسان نیست.
- Migration `003` مخزن ستون‌های `bio` و `avatar_path` را اضافه می‌کند. Migration `005` روی همین ستون‌ها مجوز UPDATE می‌دهد؛ در Schema فعلی `uirt...` این دستور به‌تنهایی به‌دلیل نبود ستون‌ها قابل اجرا نیست. علاوه بر آن، `005` Policy موجود با نام `Profiles are viewable by authenticated users` را حذف نمی‌کند؛ Policyهای permissive با OR ترکیب می‌شوند. بنابراین اعمال کورکورانهٔ آن حریم خصوصی مدنظر را تضمین نمی‌کند. اجرای واقعی یا آزمایشی هیچ Migration در این بررسی انجام نشد.
- سرویس‌های `auth`، `db` و `rest` از نظر API سلامت، healthy گزارش شدند. این نتیجه تنظیمات Email، Google OAuth، Redirect URL، SMTP یا موفقیت ورود را نشان نمی‌دهد. تنظیمات تفصیلی Auth را دریافت نکردیم، زیرا ابزار موجود ممکن است همراه آن مقادیر محرمانه را بازگرداند و فیلتر امن برای انتخاب صرفاً گزینه‌های غیرحساس ارائه نمی‌کند. در پروژهٔ `ktte...` نیز هیچ تنظیم Auth قابل بررسی نبود؛ مقایسهٔ تنظیمات Auth انجام نشده است.

## سازگاری با مخزن و محدودیت نتیجه‌گیری

Migrationهای `001` تا `005` در مخزن وجود دارند. `001` پایهٔ `profiles` و Trigger حساب را تعریف می‌کند؛ `003` فیلدهای اضافی پروفایل؛ `004` جدول‌ها و RPC Snapshot؛ و `005` Policy و مجوزهای پروفایل را. `uirt...` فقط با بخشی از این ساختار هم‌نام است و با وضعیت نهایی مورد انتظار مخزن تطابق کامل ندارد. چون Schema پروژهٔ `ktte...` قابل مشاهده نبود، **نمی‌توان گفت کدام پروژه از نظر Schema تطابق بیشتری دارد**.

اطلاعات صفر کاربر/پروفایل در `uirt...` فقط یک شمارش نقطه‌ای از دیتابیس متصل است. داده‌های `localStorage` کاربران در دستگاه‌های آنان قرار دارد و از این شمارش قابل استنتاج نیست. پروژهٔ دیگر ممکن است داده داشته باشد یا نداشته باشد؛ ما آن را نمی‌دانیم. موفقیت ظاهری سلامت سرویس نیز به معنی استفادهٔ واقعی بازیکنان نیست.

## روش، حدود و اقدام بعدی پیشنهادی

- خواندن فایل‌های تنظیمات و Migrationهای مخزن و متادیتای تاریخچهٔ GitHub؛ بررسی متادیتای Pages و build. هیچ Workflow، تنظیم Worker یا Deployment تغییر داده نشد.
- استفاده از Supabase `list_projects`، `get_project`، `get_project_health`، `list_migrations`، `list_edge_functions` و SELECTهای غیرتغییردهنده برای نام جدول‌ها، ستون‌ها، Policyها، توابع، Triggerها، وجود اجزای Snapshot و شمارش‌ها. هیچ `INSERT`، `UPDATE`، `DELETE`، DDL یا Migration اجرا نشد.
- هیچ پروژه‌ای تغییر نکرد و هیچ پروژه‌ای جایگزین نشد. تنها فایل ساخته‌شده، همین گزارش در شاخهٔ فعلی است. هیچ ادعایی دربارهٔ وضعیت جاری GitHub Pages در مرورگر کاربران یا تنظیمات محرمانهٔ سرویس‌ها مطرح نمی‌شود.
- برای تصمیم قطعی، مالک باید مشخص کند اتصال/مالکیت پروژهٔ `ktte...` متعلق به کدام حساب یا سازمان است و در صورت تمایل دسترسی **فقط‌خواندنی** همان پروژه را فراهم کند. سپس می‌توان همان متادیتا، تاریخچهٔ Migration، Auth با خروجی امن و شمارش‌های غیرشخصی را در دو پروژه مقایسه کرد. تا آن زمان از تغییر Ref، اجرای Migration، Restore یا Deployment خودداری شود.
