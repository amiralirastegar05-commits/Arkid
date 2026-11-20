// Browser + PostgreSQL integration using two synthetic users and a local fake
// Auth/PostgREST adapter. NEVER connects to a live Supabase project.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright-core';
const {Client,Pool}=createRequire(import.meta.url)('pg');
if(process.env.ARKID_DISPOSABLE_PG!=='yes')throw Error('Requires disposable local cluster');
const cfg={host:'/tmp/arkid-pg-socket',port:55439,user:process.env.USER,database:'postgres'};
const admin=new Client(cfg);await admin.connect();
assert.equal((await admin.query('show data_directory')).rows[0].data_directory,'/tmp/arkid-pg-test');assert.equal((await admin.query('show listen_addresses')).rows[0].listen_addresses,'');
const dbname='arkid_test_'+randomBytes(6).toString('hex');await admin.query(`create database ${dbname}`);
for(const role of ['anon','authenticated','service_role'])if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await admin.query(`create role ${role}`);
await admin.end();
const db=new Client({...cfg,database:dbname});await db.connect();let pool,server,browser;
const alice='00000000-0000-0000-0000-000000000001',bob='00000000-0000-0000-0000-000000000002';
const root=resolve(process.cwd()),types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.woff2':'font/woff2'};
const mock=`export function createClient(){
 const current=()=>localStorage.getItem('test-user');const session=()=>current()?{user:{id:current(),email:current()==='${alice}'?'alice@example.test':'bob@example.test'},access_token:'fake'}:null;
 const auth={getSession:async()=>({data:{session:session()},error:null}),signInWithPassword:async({email})=>{localStorage.setItem('test-user',email.startsWith('alice')?'${alice}':'${bob}');return {data:{session:session()},error:null}},signOut:async()=>{localStorage.removeItem('test-user');return {error:null}},onAuthStateChange:()=>{}};
 return {auth,rpc:async(fn,args={})=>{const r=await fetch('/__test_rpc',{method:'POST',headers:{'content-type':'application/json','x-test-user':current()||''},body:JSON.stringify({fn,args})});return await r.json()}};
}`;
try{
 await db.query(`create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const f of ['003_public_profiles.sql','004_teams_and_discovery.sql','005_announcements.sql','006_monthly_ranking.sql','007_social_safety.sql','009_moderation.sql','010_my_monthly_points.sql'])await db.query(await readFile(new URL('../../supabase/new-project/migrations/'+f,import.meta.url),'utf8'));
 await db.query('insert into auth.users(id) values($1),($2)',[alice,bob]);
 await db.query("insert into public.arkid_public_profiles(user_id,display_name,bio,is_public) values($1,'Alice','<img src=x onerror=alert(1)>',true),($2,'Bob','Hello',true)",[alice,bob]);
 await db.query('insert into public.arkid_moderators(user_id) values($1)',[alice]);
 pool=new Pool({...cfg,database:dbname,max:8});
 // Only fixed test RPCs may be called; identity is fictitious and scoped to
 // a transaction. Never forward these headers to a live server.
 async function rpc(user,{fn,args}){
  if(![alice,bob].includes(user))return {data:null,error:{message:'sign_in_required'}};
  const calls={
   arkid_my_team:['select * from public.arkid_my_team()',[],'rows'],
   arkid_team_inbox:['select * from public.arkid_team_inbox()',[],'rows'],
   arkid_announcement_feed:['select * from public.arkid_announcement_feed()',[],'rows'],
   arkid_monthly_leaderboard:['select * from public.arkid_monthly_leaderboard($1)',[args.period||null],'rows'],
   arkid_my_monthly_points:['select * from public.arkid_my_monthly_points($1)',[args.period||null],'rows'],
   arkid_my_blocks:['select * from public.arkid_my_blocks()',[],'rows'],
   arkid_search_players:['select * from public.arkid_search_players($1)',[args.query_text],'rows'],
   arkid_create_team:['select public.arkid_create_team($1) result',[args.team_name],'value'],
   arkid_invite_player:['select public.arkid_invite_player($1,$2) result',[args.team,args.target],'value'],
   arkid_respond_team_invite:['select public.arkid_respond_team_invite($1,$2) result',[args.invite,args.accept_invite],'value'],
   arkid_block_invite_sender:['select public.arkid_block_invite_sender($1) result',[args.invite],'value'],
   arkid_set_player_block:['select public.arkid_set_player_block($1,$2) result',[args.target,args.blocked],'value'],
   arkid_report_profile:['select public.arkid_report_profile($1,$2) result',[args.target,args.report_reason],'value'],
   arkid_is_moderator:['select public.arkid_is_moderator() result',[],'value'],
   arkid_moderation_queue:['select * from public.arkid_moderation_queue()',[],'rows'],
   arkid_moderation_resolve:['select public.arkid_moderation_resolve($1,$2,$3) result',[args.kind,args.report,args.outcome],'value'],
  };
  if(!Object.hasOwn(calls,fn))return {data:null,error:{message:'unexpected_operation'}};
  const client=await pool.connect();try{
   await client.query('begin');await client.query('set local role authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
   const [sql,params,shape]=calls[fn],result=await client.query(sql,params);await client.query('commit');return {data:shape==='rows'?result.rows:result.rows[0].result,error:null};
  }catch(error){await client.query('rollback');return {data:null,error:{message:error.message,code:error.code}}}finally{client.release()}
 }
 server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
  if(req.method==='POST'&&pathname==='/__test_rpc'){
   let raw='';for await(const part of req){raw+=part;if(raw.length>8192)throw Error('request too large')}
   const result=await rpc(req.headers['x-test-user'],JSON.parse(raw));res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));return;
  }
  const path=resolve(root,'.'+pathname);if(!path.startsWith(root+sep))throw Error('bad path');const body=await readFile(path);
  res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});res.end(body);
 }catch{res.writeHead(404);res.end()}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 let executablePath=process.env.CHROMIUM_PATH,args=[];if(!executablePath){const chrome=(await import('@sparticuz/chromium')).default;executablePath=await chrome.executablePath();args=chrome.args}
 browser=await chromium.launch({headless:true,executablePath,args});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith('https://esm.sh/'))return route.fulfill({status:200,contentType:'application/javascript',body:mock});if(url.startsWith(base+'/'))return route.continue();return route.abort()});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 async function login(email){await page.locator('#login button:not([disabled])').waitFor();await page.locator('[name=email]').fill(email);await page.locator('[name=password]').fill('test-password');await page.locator('#login button').click();await page.locator('#socialContent:not([hidden])').waitFor()}
 await page.goto(base+'/cloud/social.html');await login('alice@example.test');
 await page.locator('[name=teamName]').fill('ستاره‌ها');await page.locator('#createTeam button').click();await page.getByText('تیمت ساخته شد!').waitFor();
 await page.locator('#searchText').fill('Bob');await page.locator('#search button').click();await page.getByRole('button',{name:'دعوت به تیم'}).click();await page.getByText('دعوت ارسال شد. بازیکن باید آن را بپذیرد.').waitFor();
 await page.locator('#signout').click();await login('bob@example.test');await page.locator('#inbox').getByRole('button',{name:'مسدود کردن فرستنده'}).click();await page.getByText('دعوت‌های فرستنده مسدود شدند.').waitFor();
 await page.locator('#inbox').getByRole('button',{name:'پذیرفتن'}).click();await page.getByText('این بازیکن فعلاً برای دعوت در دسترس نیست.').waitFor();
 await page.locator('#blocks').getByRole('button',{name:'رفع مسدودسازی'}).click();await page.getByText('مسدودسازی برداشته شد.').waitFor();await page.locator('#inbox').getByRole('button',{name:'پذیرفتن'}).click();await page.getByText('به تیم پیوستی!').waitFor();
 await page.locator('#searchText').fill('Alice');await page.locator('#search button').click();await page.locator('#results .social-card').waitFor();assert.equal(await page.locator('#results img').count(),0);
 await page.locator('#results select').selectOption('spam');await page.locator('#results').getByRole('button',{name:'گزارش پروفایل'}).click();await page.getByText('گزارش ثبت شد؛ بررسی آن خودکار نیست.').waitFor();
 await page.locator('#signout').click();await login('alice@example.test');await page.goto(base+'/cloud/moderation.html');await page.locator('#reviewPanel:not([hidden])').waitFor();
 assert.equal(await page.locator('#reports img').count(),0);assert.match(await page.locator('#reports').innerText(),/<img src=x/);
 await page.getByRole('button',{name:'بررسی شد'}).click();await page.getByText('نتیجهٔ بررسی ثبت شد.').waitFor();
 assert.deepEqual(errors,[]);assert.equal((await db.query('select count(*)::int n from public.arkid_team_members where left_at is null')).rows[0].n,2);
 assert.equal((await db.query("select count(*)::int n from public.arkid_social_reports where status='reviewed'")).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from public.arkid_moderation_actions')).rows[0].n,1);
 console.log('Two synthetic accounts: browser → authenticated PostgreSQL teams, blocks, reports and owner review passed');await context.close();
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();await db.end()}
