import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migrations, compare-and-swap and RLS on PostgreSQL', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    for (const file of ['001_profiles.sql','002_profiles_policy_perf.sql','003_profiles_extend_existing.sql','004_cloud_snapshots.sql','005_profile_privacy.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
    }
    const one = '00000000-0000-0000-0000-000000000001', two = '00000000-0000-0000-0000-000000000002';
    await db.exec(`insert into auth.users(id,raw_user_meta_data) values ('${one}','{"name":"test"}'), ('${two}','{}'); set role authenticated; select set_config('request.jwt.claim.sub','${one}',false);`);
    const snapshot = JSON.stringify({schema:1,storage:{arcade_points:'10'}});
    const insert = await db.query('select * from public.arkid_save_snapshot($1,null,$2::jsonb)',[one,snapshot]);
    const revision = insert.rows[0].revision;
    await assert.rejects(db.query('select public.arkid_save_snapshot($1,null,$2::jsonb)',[one,snapshot]), /snapshot conflict/);
    await assert.rejects(db.query('select public.arkid_save_snapshot($1,null,$2::jsonb)',[two,snapshot]), /account changed/);
    await db.query('select public.arkid_save_snapshot($1,$2,$3::jsonb)',[one,revision,snapshot]);
    assert.equal(Number((await db.query('select count(*) from public.arkid_cloud_snapshot_history')).rows[0].count),1);
    assert.equal(Number((await db.query('select count(*) from public.profiles')).rows[0].count),1);
    await assert.rejects(db.query('update public.profiles set created_at=now()'), /permission denied/);
    await assert.rejects(db.query('delete from public.arkid_cloud_snapshots'), /permission denied/);
    await db.exec(`select set_config('request.jwt.claim.sub','${two}',false);`);
    assert.equal(Number((await db.query('select count(*) from public.arkid_cloud_snapshots')).rows[0].count),0);
    assert.equal(Number((await db.query('select count(*) from public.arkid_cloud_snapshot_history')).rows[0].count),0);
  } finally { await db.close(); }
});
