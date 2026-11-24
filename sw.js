/* ★ PWA: نسخهٔ مستقل؛ فایل‌های مفقود مانع نصب نمی‌شوند */
const CACHE_VERSION='arcade-2026-11-v31';
const CORE=CACHE_VERSION+'-core',BANNERS=CACHE_VERSION+'-banners';
const ROOT=new URL('./',self.location.href);
const CORE_URLS=['./','index.html','tictactoe.html','tictactoe.css','tictactoe.js','tictactoe-engine.js','flappy.html','flappy.css','flappy.js','flappy-engine.js','arcade-gamepad.js','arcade-gamepad.css','arcade-upgrade.css','liquid-ui.css','arkid-refresh.css','game-landing.css','arcade-icons.css','arcade-polish.js','hub-enhancements.js','auth.css','auth.js','cloud/arcade-auth.js','cloud/config.js','cloud/snapshot.js','cloud/messages.js','cloud/entry-gate.js','cloud/entry-gate.css','cloud/restore.html','cloud/restore.css','cloud/restore.js','cloud/worker-diagnostic.js','cloud/worker-check.html','manifest.webmanifest','arcade-icon-192.png','arcade-icon-512.png','Ali_Grapph_medium.woff2','Ali_Grapph_bold.woff2','assets/game-covers/tictactoe.svg','assets/game-covers/flappy.svg','assets/game-covers/river-raid.webp','assets/game-covers/river-raid.jpg','assets/game-covers/space-invaders.webp','assets/game-covers/space-invaders.jpg','assets/game-covers/mushroom-killer.webp','assets/game-covers/mushroom-killer.jpg','assets/game-covers/mushroom-platformer.webp','assets/game-covers/mushroom-platformer.jpg','assets/game-covers/arcade-runner.svg','assets/game-covers/2048.webp','assets/game-covers/2048.jpg','assets/game-covers/breakout.webp','assets/game-covers/breakout.jpg','assets/game-covers/snake.webp','assets/game-covers/snake.jpg','assets/game-covers/asteroids.webp','assets/game-covers/asteroids.jpg','assets/game-covers/pong.webp','assets/game-covers/pong.jpg','assets/game-covers/tetris.svg','assets/game-covers/pacman.svg','assets/game-covers/game-runner.svg'];
const offlinePage=()=>new Response('<html lang="fa" dir="rtl"><meta charset="utf-8"><title>بازی آفلاین</title><h1>این بازی هنوز برای حالت آفلاین ذخیره نشده است.</h1><p>یک بار با اینترنت بازی را باز کنید.</p><a href="'+new URL('index.html',ROOT).href+'">بازگشت به آرکید</a></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CORE);await Promise.allSettled(CORE_URLS.map(async path=>{const response=await fetch(new URL(path,ROOT),{cache:'reload'});if(response.ok)await cache.put(new URL(path,ROOT),response)}));self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(k=>k.startsWith('arcade-')&&!k.startsWith(CACHE_VERSION)).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('message',event=>{if(event.data?.type!=='ARCADE_CACHE'||!Array.isArray(event.data.urls))return;event.waitUntil((async()=>{const cache=await caches.open(CORE);await Promise.allSettled(event.data.urls.slice(0,100).map(async path=>{const url=new URL(path,ROOT);if(url.origin!==ROOT.origin)return;const response=await fetch(url);if(response.ok)await cache.put(url,response)}))})())});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==ROOT.origin)return;
  if(request.destination==='image'||/\/bb\d+\.(webp|png|jpe?g)$/i.test(url.pathname)){
    event.respondWith((async()=>{
      const cache=await caches.open(BANNERS);
      try{
        const response=await fetch(request);
        if(response.ok){await cache.put(request,response.clone());return response}
        return await cache.match(request)||response;
      }catch(_){return await cache.match(request)||await (await caches.open(CORE)).match(request)||Response.error()}
    })());
    return;
  }
  if(!(/\.(html|css|js|woff2?|ttf|otf)$/i.test(url.pathname)||url.pathname.endsWith('/')))return;
  // شبکه اول، کش دوم: هاب و دارایی‌ها همیشه تازه‌اند و آفلاین هم کار می‌کند.
  // درخواست HEAD هرگز کش نمی‌شود تا بررسی وجود فایل نتیجهٔ واقعی بگیرد.
  event.respondWith((async()=>{
    const cache=await caches.open(CORE),key=new URL(url);
    key.searchParams.delete('_t');
    if(/\.html$/i.test(key.pathname)&&!key.pathname.endsWith('/index.html'))key.search='';
    try{
      const response=await fetch(request,{cache:'no-store'});
      if(response&&response.ok)await cache.put(key.href,response.clone());
      return response;
    }catch(_){
      const hit=await cache.match(key.href);
      if(hit)return hit;
      if(request.mode==='navigate'){
        if(url.pathname.endsWith('/')||url.pathname.endsWith('/index.html'))return await cache.match(new URL('index.html',ROOT).href)||offlinePage();
        return offlinePage();
      }
      return Response.error();
    }
  })());
});
