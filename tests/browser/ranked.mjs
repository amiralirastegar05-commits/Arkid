// Optional Chromium end-to-end smoke test: local fake auth and fake ranked API.
// No Supabase, real secrets, game progress or real scores are touched.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {replayRanked2048} from '../../worker/src/ranked-2048.js';
const root=resolve(process.cwd());
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+sep))throw Error();const bytes=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'});res.end(bytes)}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
let executablePath=process.env.CHROMIUM_PATH,args=[];if(!executablePath){const chrome=(await import('@sparticuz/chromium')).default;executablePath=await chrome.executablePath();args=chrome.args}
const user='00000000-0000-0000-0000-000000000001',id='00000000-0000-0000-0000-000000000002';
const authMock=`export function createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:'${user}'},access_token:'mock'}},error:null}),onAuthStateChange:()=>{},signOut:async()=>({error:null})}}}`;
const signedOutMock=`export function createClient(){return {auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>{},signOut:async()=>({error:null})}}}`;
const directions=['L','U','R','D'],moves=[];let game=replayRanked2048(9,moves);
for(let i=0;i<700&&!game.finished;i++)for(let j=0;j<4;j++){const d=directions[(i+j)%4];try{game=replayRanked2048(9,[...moves,d]);moves.push(d);break}catch(e){if(e.message!=='invalid_move')throw e}}
assert.equal(game.finished,true);
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath,args});const ctx=await browser.newContext({viewport:{width:320,height:800},hasTouch:true});
 let lastSubmit=null,enabled=true,signedIn=true;
 await ctx.route('**/*',async route=>{const url=route.request().url();
  if(url.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',body:signedIn?authMock:signedOutMock});
  if(url.startsWith('https://arkid-api-now.nova-197b21.workers.dev/v1/ranked/')){
   if(!enabled)return route.fulfill({status:503,json:{error:'ranked_unavailable'}});
   const body=route.request().postDataJSON(),finished=url.endsWith('/submit');
   if(finished){lastSubmit=body;assert.deepEqual(body.moves,moves)}
   return route.fulfill({status:200,json:{session:{id,seed:9,rulesVersion:'2048-v1',status:finished?'completed':'open',expiresAt:Date.now()+600000,points:finished?game.score:null}}});
  }
  return url.startsWith(origin+'/')?route.continue():route.abort();
 });
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,1440]){
  await page.setViewportSize({width,height:850});await page.goto(`${origin}/cloud/ranked-2048.html`);
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('user-game-data','preserve')});await page.reload();
  await page.locator('#start:not([disabled])').waitFor();await page.locator('#start').click();await page.locator('#gamePanel:not([hidden])').waitFor();
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));assert.ok(dims.scroll<=dims.width+1,JSON.stringify(dims));
  for(const move of moves.slice(0,10))await page.locator(`[data-move=${move}]`).click();
  const before=await page.locator('#score').innerText();await page.reload();await page.locator('#start:not([disabled])').waitFor();await page.locator('#start').click();await page.locator('#gamePanel:not([hidden])').waitFor();assert.equal(await page.locator('#score').innerText(),before);
  for(const move of moves.slice(10))await page.locator(`[data-move=${move}]`).click();
  await page.locator('#submit:not([hidden])').waitFor();await page.locator('#submit').click();await page.getByText(/امتیاز تأیید و ثبت شد/).waitFor();assert.deepEqual(lastSubmit.moves,moves);
  assert.equal(await page.evaluate(()=>localStorage.getItem('user-game-data')),'preserve');
  enabled=false;await page.locator('#start').click();await page.getByText('مسابقه فعلاً فعال نیست. بعداً دوباره سر بزن.').waitFor();enabled=true;
  console.log(`ranked ${width}px: play, reload/resume, submit and disabled service OK`);
 }
 signedIn=false;await page.goto(`${origin}/cloud/ranked-2048.html`);await page.locator('#login:not([hidden])').waitFor();assert.equal(await page.locator('#start').isDisabled(),true);
 assert.deepEqual(errors,[]);await ctx.close();
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
