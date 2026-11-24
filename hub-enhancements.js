/* Small, local-only helpers. They neither award points nor contact a server. */
(function (root) {
  'use strict';
  const guides = {
    'flappy': ['با پرنده از بین لوله‌ها رد شو و برای هر جفت یک امتیاز بگیر.', 'صفحه را لمس کن یا کلید فاصله یا جهت بالا را بزن؛ برای مکث از دکمهٔ توقف استفاده کن.'],
    'river-raid': ['در مسیر رودخانه پیش برو سوخت جمع کن و از برخورد با موانع دوری کن.', 'برای حرکت از جهت‌ها یا کنترل لمسی و برای شلیک از دکمهٔ آتش استفاده کن.'],
    'space-invaders': ['مهاجم‌ها را پیش از رسیدن به زمین متوقف کن.', 'با جهت‌های چپ و راست حرکت کن و با دکمهٔ شلیک آتش بزن.'],
    'mushroom-killer': ['دشمن‌ها را هدف بگیر و تا جای ممکن زنده بمان.', 'با کنترل‌های جهت حرکت کن و با لمس یا دکمهٔ شلیک هدف بگیر.'],
    'mushroom-platformer': ['از سکوها عبور کن، سکه جمع کن و به پایان مرحله برس.', 'با جهت‌های چپ و راست حرکت کن و از دکمهٔ پرش استفاده کن.'],
    'arcade-runner': ['از موانع و دشمنان عبور کن و سکه‌ها را جمع کن.', 'با جهت‌ها حرکت کن و برای پرش یا شلیک از دکمه‌های بازی استفاده کن.'],
    '2048': ['کاشی‌های هم‌عدد را ترکیب کن و به عدد ۲۰۴۸ برس.', 'روی صفحه به چهار جهت بکش یا از کلیدهای جهت استفاده کن.'],
    'breakout': ['آجرها را با توپ بشکن و نگذار توپ از پایین خارج شود.', 'برای جابه‌جایی راکت از کنترل‌های بازی استفاده کن.'],
    'snake': ['خوراکی‌ها را جمع کن و به دیوار یا بدن مار برخورد نکن.', 'با جهت‌ها یا کشیدن انگشت مسیر مار را تغییر بده.'],
    'asteroids': ['سیارک‌ها را نابود کن و از برخورد دور بمان.', 'با کنترل‌های بازی بچرخ، حرکت کن و شلیک کن.'],
    'pong': ['توپ را با راکت برگردان و از حریف امتیاز بگیر.', 'با کنترل‌های صفحه یا کیبورد راکت را حرکت بده.'],
    'tetris': ['قطعه‌ها را کنار هم بچین و خط‌های کامل بساز.', 'با جهت‌ها یا دکمه‌های بازی قطعه‌ها را حرکت بده و بچرخان.'],
    'pacman': ['نقطه‌ها را جمع کن و از روح‌ها دور بمان.', 'با جهت‌ها یا کشیدن انگشت مسیر را انتخاب کن.'],
    'game-runner': ['از خودروها دوری کن و سکه جمع کن.', 'جاده را لمس کن یا دکمه‌های چپ و راست را نگه دار؛ با دکمهٔ مکث بازی را متوقف کن.']
  };
  const count = x => Number.isFinite(Number(x)) ? Math.max(0, Math.floor(Number(x))) : 0;
  function achievementProgress(id, st, games, unlocked, filesChecked, now) {
    const available = games.filter(g => g.available), played = st.playsPerGame || {}, scores = st.scoresPerGame || {};
    const done = Object.keys(unlocked).length;
    const numeric = (value, goal, unit) => ({ value:Math.min(count(value),goal), goal, unit });
    switch (id) {
      case 'first-step': return numeric(st.totalPlays,1,'بازی');
      case 'addict': return numeric(st.totalPlays,100,'بازی');
      case 'sprinter': return numeric(st.playsToday,5,'بازی در آخرین روز ثبت‌شده');
      case 'weekly': return numeric(st.dailyStreak,7,'روز پیاپی ثبت‌شده');
      case 'king': return numeric(st.totalScore,50001,'امتیاز مجموع');
      case 'diamond': return numeric(st.totalScore,100001,'امتیاز مجموع');
      case 'stargazer': return numeric(Object.values(scores).filter(v=>v>1000).length,3,'بازی با رکورد بالای ۱۰۰۰');
      case 'sharpshooter': return numeric(Object.values(scores).filter(v=>v>=2000).length,3,'بازی با رکورد حداقل ۲۰۰۰');
      case 'whirlwind': return numeric((st.playTimestamps || []).filter(t=>now-t<=300000).length,3,'بازی در ۵ دقیقه');
      case 'halfway': return numeric(done,8,'دستاورد');
      case 'legend': return numeric(done,14,'دستاورد دیگر');
      case 'explorer': case 'polyglot':
        return filesChecked && available.length ? numeric(available.filter(g=>count(played[g.id])>0).length,available.length,'بازی موجود') : { hint:'در حال بررسی بازی‌های موجود' };
      case 'collector':
        return filesChecked && available.length ? numeric(Object.keys(played).filter(k=>count(played[k])>0).length,Math.ceil(available.length*.5),'بازی') : { hint:'در حال بررسی بازی‌های موجود' };
      case 'nightowl': return {hint:'بین ساعت ۲ تا ۴ بامداد بازی کن.'};
      default: return {hint:'برای باز کردن، شرط بالا را انجام بده.'};
    }
  }
  const BACKUP_KEY = 'arkid_backup_reminder_v1', META_KEY = 'arkid_cloud_snapshot_meta_v1', WEEK = 7*24*60*60*1000;
  function read(storage, key) { try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; } }
  function recordBackup(storage, user, now = Date.now()) {
    try {
      const meta = read(storage, META_KEY);
      if (!user || !meta || meta.user !== user || typeof meta.project !== 'string' || typeof meta.revision !== 'string' || !Number.isFinite(now)) return false;
      storage.setItem(BACKUP_KEY, JSON.stringify({user, project:meta.project, revision:meta.revision, at:now}));
      return true;
    } catch (_) { return false; }
  }
  function backupState(storage, user, now = Date.now()) {
    const marker=read(storage,BACKUP_KEY), meta=read(storage,META_KEY);
    const valid=!!(user && marker && meta && marker.user===user && meta.user===user && marker.project===meta.project && marker.revision===meta.revision && Number.isFinite(marker.at) && marker.at>0 && marker.at<=now);
    return !valid ? 'unknown' : now-marker.at>=WEEK ? 'old' : 'recent';
  }
  root.ArkidHubEnhancements=Object.freeze({guides, achievementProgress, recordBackup, backupState, BACKUP_KEY});
})(globalThis);
