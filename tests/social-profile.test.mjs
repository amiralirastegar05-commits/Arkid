import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {validatePublicProfile, currentUser, readOwnProfile, saveOwnProfile} from '../cloud/public-profile.js';

const alice='00000000-0000-0000-0000-000000000001';
const bob='00000000-0000-0000-0000-000000000002';

test('social migration protects private profiles and permits only opt-in discovery', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    for (const f of ['001_profiles.sql','002_snapshots.sql','003_public_profiles.sql','004_teams_and_discovery.sql']) {
      await db.exec(await readFile(new URL('../supabase/new-project/migrations/'+f, import.meta.url),'utf8'));
    }
    await db.exec(`insert into auth.users(id,raw_user_meta_data) values ('${alice}','{"name":"Private Alice"}'),('${bob}','{"name":"Private Bob"}'); set role authenticated; select set_config('request.jwt.claim.sub','${alice}',false);`);
    assert.equal((await db.query('select count(*)::int n from public.arkid_public_profiles')).rows[0].n,0);
    await db.query('insert into public.arkid_public_profiles(user_id,display_name,bio) values($1,$2,$3)',[alice,'Alice','hello']);
    assert.equal((await db.query('select is_public from public.arkid_public_profiles where user_id=$1',[alice])).rows[0].is_public,false);
    await assert.rejects(db.query('insert into public.arkid_public_profiles(user_id,display_name) values($1,$2)',[bob,'impersonation']),/row-level security/);
    await assert.rejects(db.query('update public.arkid_public_profiles set user_id=$1 where user_id=$2',[bob,alice]),/permission denied/);
    await assert.rejects(db.query('delete from public.arkid_public_profiles'),/permission denied/);
    const old=(await db.query('select revision from public.arkid_public_profiles where user_id=$1',[alice])).rows[0].revision;
    await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false);`);
    assert.equal((await db.query('select count(*)::int n from public.arkid_public_profiles')).rows[0].n,0);
    assert.equal((await db.query('update public.arkid_public_profiles set bio=$1 where user_id=$2 returning user_id',['bad',alice])).rows.length,0);
    await db.exec(`select set_config('request.jwt.claim.sub','${alice}',false);`);
    await db.query('update public.arkid_public_profiles set is_public=true where user_id=$1',[alice]);
    const next=(await db.query('select revision from public.arkid_public_profiles where user_id=$1',[alice])).rows[0].revision;
    assert.notEqual(next,old);
    assert.equal((await db.query('update public.arkid_public_profiles set bio=$1 where user_id=$2 and revision=$3 returning bio',['stale',alice,old])).rows.length,0);
    await assert.rejects(db.query('update public.arkid_public_profiles set display_name=$1 where user_id=$2',['x'.repeat(41),alice]),/check constraint/);
    await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false);`);
    assert.equal((await db.query('select count(*)::int n from public.arkid_public_profiles')).rows[0].n,0);
    const visible=(await db.query('select user_id,display_name,bio from public.arkid_search_players($1)',['Al'])).rows;
    assert.deepEqual(visible,[{user_id:alice,display_name:'Alice',bio:'hello'}]);
    assert.equal((await db.query('select count(*)::int n from public.profiles where id=$1',[alice])).rows[0].n,0);
    await db.exec(`select set_config('request.jwt.claim.sub','${alice}',false);`);
    await db.query('update public.arkid_public_profiles set is_public=false where user_id=$1',[alice]);
    await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false);`);
    assert.equal((await db.query('select count(*)::int n from public.arkid_public_profiles')).rows[0].n,0);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.arkid_public_profiles'),/permission denied/);
  } finally { await db.close(); }
});

test('profile validation and RLS-safe compare-and-swap calls', async () => {
  assert.deepEqual(validatePublicProfile({name:' Alice ',bio:' hello ',isPublic:false}),{display_name:'Alice',bio:'hello',is_public:false});
  assert.throws(()=>validatePublicProfile({name:' ',bio:'',isPublic:false}),/invalid_name/);
  assert.throws(()=>validatePublicProfile({name:'a',bio:'x'.repeat(161),isPublic:false}),/invalid_bio/);
  assert.throws(()=>validatePublicProfile({name:'a',bio:'',isPublic:'true'}),/invalid_visibility/);
  let session=alice, calls=[], response={data:{user_id:alice,revision:'rev2'},error:null};
  const chain={select(x){calls.push(['select',x]);return this},eq(k,v){calls.push(['eq',k,v]);return this},maybeSingle:async()=>response,single:async()=>response,update(v){calls.push(['update',v]);return this},insert(v){calls.push(['insert',v]);return this}};
  const client={auth:{getSession:async()=>({data:{session:session?{user:{id:session}}:null},error:null})},from:t=>{calls.push(['from',t]);return chain}};
  assert.equal(await currentUser(client),alice);
  await saveOwnProfile(client,alice,{user_id:alice,revision:'rev1'},{name:'Alice',bio:'b',isPublic:true});
  assert.ok(calls.some(x=>x[0]==='eq'&&x[1]==='user_id'&&x[2]===alice));
  assert.ok(calls.some(x=>x[0]==='eq'&&x[1]==='revision'&&x[2]==='rev1'));
  response={data:null,error:null};
  await assert.rejects(saveOwnProfile(client,alice,{user_id:alice,revision:'stale'},{name:'Alice',bio:'',isPublic:false}),/stale_profile/);
  response={data:null,error:{code:'23505'}};
  await assert.rejects(saveOwnProfile(client,alice,null,{name:'Alice',bio:'',isPublic:false}),/stale_profile/);
  session=bob;
  await assert.rejects(readOwnProfile(client,alice),/account_changed/);
});
