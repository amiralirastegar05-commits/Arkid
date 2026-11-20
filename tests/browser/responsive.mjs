// Optional visual-layout smoke test. Requires playwright-core and a local Chromium;
// it never contacts Supabase and uses only in-memory mock data.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const root=resolve(process.cwd());
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
    if(!path.startsWith(root+sep))throw Error('invalid path');
    const body=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let executablePath=process.env.CHROMIUM_PATH,args=[];
if(!executablePath){const chrome=(await import('@sparticuz/chromium')).default;executablePath=await chrome.executablePath();args=chrome.args}
const mock=`export function createClient(){
 const user={id:'alice',email:'player@example.test'};
 const auth={getSession:async()=>({data:{session:{user}},error:null}),onAuthStateChange:()=>{},signOut:async()=>({error:null})};
 const rpc=async(fn,args={})=>{
  if(fn==='arkid_is_moderator')return {error:null,data:localStorage.getItem('mock_mod')!=='denied'};
  if(fn==='arkid_moderation_queue')return {error:null,data:localStorage.getItem('mock_reviewed')==='yes'?[]:[{report_id:'r1',kind:'profile',reason:'spam',subject_id:'bob',name_snapshot:'<img src=x onerror=alert(1)>',bio_snapshot:'B'.repeat(160)}]};
  if(fn==='arkid_moderation_resolve'){localStorage.setItem('mock_reviewed','yes');return {error:null,data:args.outcome}}
  if(fn==='arkid_set_player_block'){localStorage.setItem('mock_block',args.blocked?'yes':'no');return {error:null,data:args.blocked?'blocked':'unblocked'}}
  if(fn==='arkid_block_invite_sender'){localStorage.setItem('mock_block','yes');return {error:null,data:'blocked'}}
  if(fn==='arkid_report_profile'||fn==='arkid_report_team'){localStorage.setItem('mock_report',fn+':'+args.report_reason);return {error:null,data:'reported'}}
  return {error:null,data:({
  arkid_my_blocks:localStorage.getItem('mock_block')==='yes'?[{user_id:'bob',display_name:'B'.repeat(40)}]:[],
  arkid_my_team:[{team_id:'team',team_name:'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',owner_id:'alice',members:[{user_id:'alice',display_name:'A'.repeat(40)},{user_id:'bob',display_name:'B'.repeat(40)}]}],
  arkid_team_inbox:[{invite_id:'i',team_name:'T'.repeat(32),sender_name:'S'.repeat(40)}],
  arkid_announcement_feed:[{announcement_id:'n',title:'N'.repeat(100),body:'متن '.repeat(80),is_read:false}],
  arkid_monthly_leaderboard:[{place:1,display_name:'P'.repeat(40),points:12345}],
  arkid_my_monthly_points:[{month_utc:'2025-03-01',points:600}],
  arkid_search_players:[{user_id:'bob',display_name:'B'.repeat(40),bio:'Z'.repeat(160)}]
 })[fn]||[]};};
 const from=()=>{const b={select:()=>b,eq:()=>b,maybeSingle:async()=>({data:{user_id:'alice',display_name:'A'.repeat(40),bio:'B'.repeat(160),is_public:false,revision:'r'},error:null})};return b};
 return {auth,rpc,from};
}`;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath,args});
 const context=await browser.newContext({viewport:{width:320,height:800},hasTouch:true});
 async function mockRoutes(ctx){await ctx.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',body:mock});
   if(url.startsWith(`http://127.0.0.1:${port}/`))return route.continue();
   return route.abort();
 })}
 await mockRoutes(context);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 async function noOverflow(label){
   const dims=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
   assert.ok(dims.document<=dims.viewport+1&&dims.body<=dims.viewport+1,`${label}: horizontal overflow ${JSON.stringify(dims)}`);
 }
 for(const width of [320,375,768,1024,1440]){
   await page.setViewportSize({width,height:850});
   await page.goto(`http://127.0.0.1:${port}/cloud/social.html`);
   await page.locator('#socialContent:not([hidden])').waitFor();await page.locator('#myRank').getByText('ردهٔ تو: برنزی').waitFor();
   await page.locator('#searchText').fill('Bob');await page.locator('#search button').click();await page.locator('#results .social-card').waitFor();
   if(width===375){
     await page.locator('#results select').selectOption('spam');await page.getByRole('button',{name:'گزارش پروفایل'}).click();
     await page.getByText('گزارش ثبت شد؛ بررسی آن خودکار نیست.').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('mock_report')),'arkid_report_profile:spam');
     await page.locator('#inbox select').selectOption('inappropriate');await page.locator('#inbox').getByRole('button',{name:'گزارش نام تیم'}).click();
     await page.getByText('گزارش ثبت شد؛ بررسی آن خودکار نیست.').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('mock_report')),'arkid_report_team:inappropriate');
     await page.getByRole('button',{name:'مسدود کردن دعوت‌ها'}).click();await page.locator('#blocks').getByRole('button',{name:'رفع مسدودسازی'}).waitFor();
     await page.locator('#blocks').getByRole('button',{name:'رفع مسدودسازی'}).click();await page.getByText('مسدودسازی برداشته شد.').waitFor();
     await page.locator('#search button').click();await page.locator('#results .social-card').waitFor();
   }
   await noOverflow(`social ${width}`);
   const targets=await page.locator('.small-button:visible').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
   assert.ok(targets.every(height=>height>=44),`small tap target at ${width}`);
   if(width>=900){const boxes=await page.locator('#socialContent > .social-section').evaluateAll(nodes=>nodes.slice(0,2).map(n=>n.getBoundingClientRect().x));assert.notEqual(boxes[0],boxes[1],'desktop should use two columns')}
   await page.goto(`http://127.0.0.1:${port}/cloud/public-profile.html`);
   await page.locator('#profileForm:not([hidden])').waitFor();await noOverflow(`profile ${width}`);
   assert.equal(await page.locator('#visibility').isChecked(),false);
   await page.goto(`http://127.0.0.1:${port}/cloud/moderation.html`);await page.locator('#reviewPanel:not([hidden])').waitFor();await noOverflow(`moderation ${width}`);
   if(width===320){assert.equal(await page.locator('#reports img').count(),0);await page.getByRole('button',{name:'بررسی شد'}).click();await page.getByText('نتیجهٔ بررسی ثبت شد.').waitFor();}
   if(width===375){await page.evaluate(()=>localStorage.setItem('mock_mod','denied'));await page.reload();await page.locator('#deniedPanel:not([hidden])').waitFor();assert.equal(await page.locator('#ownId').innerText(),'alice');await page.evaluate(()=>localStorage.removeItem('mock_mod'))}
   console.log(`responsive ${width}px: social, profile and moderation OK`);
 }
 assert.deepEqual(errors,[]);
 await context.close();await browser.close();
 // A separate non-touch desktop browser also exercises keyboard focus.
 browser=await chromium.launch({headless:true,executablePath,args});
 const desktop=await browser.newContext({viewport:{width:1440,height:900},hasTouch:false});await mockRoutes(desktop);
 const desktopPage=await desktop.newPage(),desktopErrors=[];desktopPage.on('pageerror',e=>desktopErrors.push(e.message));
 await desktopPage.goto(`http://127.0.0.1:${port}/cloud/social.html`);await desktopPage.locator('#socialContent:not([hidden])').waitFor();
 await desktopPage.keyboard.press('Tab');
 assert.equal(await desktopPage.evaluate(()=>document.activeElement.className),'back-link');
 assert.notEqual(await desktopPage.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'none');
 assert.deepEqual(desktopErrors,[]);await desktop.close();console.log('desktop mouse and keyboard focus: OK');
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
