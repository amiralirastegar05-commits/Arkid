import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const u=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
test('update announcements expose only active publications and own read state',async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/new-project/migrations/005_announcements.sql',import.meta.url),'utf8'));
  for(let i=1;i<=2;i++)await db.query('insert into auth.users values($1,$2::jsonb)',[u(i),'{}']);
  await db.query("insert into public.arkid_announcements(id,title,body,published,starts_at,ends_at) values($1,'Active','hello',true,now()-interval '1 minute',null),($2,'Draft','secret',false,now()-interval '1 minute',null),($3,'Future','secret',true,now()+interval '1 hour',null),($4,'Expired','secret',true,now()-interval '2 hours',now()-interval '1 hour')",[u(11),u(12),u(13),u(14)]);
  await db.exec('set role authenticated');const as=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[u(n)]);await as(1);
  let feed=(await db.query('select * from public.arkid_announcement_feed()')).rows;
  assert.equal(feed.length,1);assert.equal(feed[0].title,'Active');assert.equal(feed[0].is_read,false);
  for(const n of [12,13,14])await assert.rejects(db.query('select public.arkid_read_announcement($1)',[u(n)]),/announcement_unavailable/);
  await assert.rejects(db.query('select * from public.arkid_announcements'),/permission denied/);
  await assert.rejects(db.query('insert into public.arkid_announcements(title,body,published) values ($1,$2,true)',['Fake','Fake']),/permission denied/);
  await assert.rejects(db.query('select * from public.arkid_announcement_reads'),/permission denied/);
  assert.equal((await db.query('select public.arkid_read_announcement($1) result',[u(11)])).rows[0].result,'read');
  await db.query('select public.arkid_read_announcement($1)',[u(11)]);
  feed=(await db.query('select * from public.arkid_announcement_feed()')).rows;assert.equal(feed[0].is_read,true);
  await as(2);assert.equal((await db.query('select * from public.arkid_announcement_feed()')).rows[0].is_read,false);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.arkid_announcement_reads')).rows[0].n,1);
  await db.exec('set role anon');await assert.rejects(db.query('select * from public.arkid_announcement_feed()'),/permission denied/);
 }finally{await db.close()}
});
