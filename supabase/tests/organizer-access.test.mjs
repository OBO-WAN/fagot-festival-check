import { before, beforeEach, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const migration = await readFile(new URL('../organizer-access.sql', import.meta.url), 'utf8');
let db;

async function asRole(role, userId, callback) {
  await db.exec('reset role;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  await db.exec(`set role ${role};`);
  try { return await callback(); } finally { await db.exec('reset role;'); }
}

const denied = query => assert.rejects(query, error => error.code === '42501');
const visitorInsert = "insert into public.festival_intake (name,email,bassoon_system,ownership,playability) values ('Visitor','visitor@example.com','Alemán (Heckel)','Es mío','Sí')";

describe('Single-account organizer database access', { concurrency: false }, () => {
  before(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users values ('${owner}'), ('${other}');
      create function auth.uid() returns uuid language sql stable set search_path = ''
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
      grant usage on schema auth to anon, authenticated;
    `);
    await db.exec(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
    await db.exec(migration);
    await db.exec(visitorInsert);
  });

  beforeEach(async () => {
    await db.exec('reset role;');
    await db.query('insert into festival_private.organizer_account (singleton,user_id) values (true,$1) on conflict(singleton) do update set user_id=excluded.user_id', [owner]);
  });
  after(async () => { await db.close(); });

  it('keeps anonymous submission working but denies read, update, delete and access RPC', async () => {
    await asRole('anon', null, async () => {
      await db.exec(visitorInsert);
      await denied(db.query('select * from public.festival_intake'));
      await denied(db.query("update public.festival_intake set name='Changed'"));
      await denied(db.query('delete from public.festival_intake'));
      await denied(db.query('select public.festival_organizer_access()'));
      await denied(db.query("insert into public.festival_intake (id,name,email,bassoon_system,ownership,playability) values ('33333333-3333-4333-8333-333333333333','Visitor','v@example.com','Alemán (Heckel)','Es mío','Sí')"));
    });
  });

  it('allows only the bound account to authorize and read all responses', async () => {
    const count = (await db.query('select count(*)::integer as total from public.festival_intake')).rows[0].total;
    await asRole('authenticated', owner, async () => {
      assert.equal((await db.query('select public.festival_organizer_access() as allowed')).rows[0].allowed, true);
      assert.equal((await db.query('select count(*)::integer as total from public.festival_intake')).rows[0].total, count);
      await denied(db.query(visitorInsert));
      await denied(db.query("update public.festival_intake set name='Changed'"));
      await denied(db.query('delete from public.festival_intake'));
    });
  });

  it('denies response data to a different signed-in account or a missing identity', async () => {
    for (const identity of [other, null]) {
      await asRole('authenticated', identity, async () => {
        assert.equal((await db.query('select public.festival_organizer_access() as allowed')).rows[0].allowed, false);
        assert.equal((await db.query('select * from public.festival_intake')).rows.length, 0);
      });
    }
  });

  it('prevents every client account from reading or changing the authorization binding', async () => {
    for (const identity of [owner, other]) {
      await asRole('authenticated', identity, async () => {
        await denied(db.query('select * from festival_private.organizer_account'));
        await denied(db.query('delete from festival_private.organizer_account'));
        await denied(db.query('update festival_private.organizer_account set user_id=$1', [other]));
        await denied(db.query('insert into festival_private.organizer_account(singleton,user_id) values (true,$1)', [other]));
      });
    }
  });

  it('supports exactly one account and immediately applies replacement and revocation', async () => {
    await assert.rejects(db.query('insert into festival_private.organizer_account(singleton,user_id) values(false,$1)', [other]), error => error.code === '23514');
    await assert.rejects(db.query('insert into festival_private.organizer_account(singleton,user_id) values(true,$1)', [other]), error => error.code === '23505');
    await db.query('update festival_private.organizer_account set user_id=$1', [other]);
    await asRole('authenticated', owner, async () => assert.equal((await db.query('select * from public.festival_intake')).rows.length, 0));
    await asRole('authenticated', other, async () => assert.equal((await db.query('select public.festival_organizer_access() as allowed')).rows[0].allowed, true));
    await db.exec('delete from festival_private.organizer_account;');
    await asRole('authenticated', other, async () => assert.equal((await db.query('select * from public.festival_intake')).rows.length, 0));
  });

  it('ignores caller-controlled search paths and keeps elevated privileges in the private schema', async () => {
    await asRole('authenticated', other, async () => {
      await db.exec('create temporary table organizer_account (singleton boolean,user_id uuid);');
      await db.query('insert into organizer_account values(true,$1)', [other]);
      await db.exec('set search_path=pg_temp,public;');
      assert.equal((await db.query('select public.festival_organizer_access() as allowed')).rows[0].allowed, false);
      await db.exec('reset search_path;');
    });
    const functions = (await db.query("select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('is_organizer','festival_organizer_access')")).rows;
    assert.equal(functions.find(row => row.proname === 'festival_organizer_access').prosecdef, false);
    const definer = functions.find(row => row.proname === 'is_organizer');
    assert.equal(definer.nspname, 'festival_private');
    assert.equal(definer.prosecdef, true);
    assert.ok(definer.proconfig.some(value => value.startsWith('search_path=')));
  });

  it('can rerun the migration without losing the account or saved responses', async () => {
    const beforeCount = (await db.query('select count(*)::integer as total from public.festival_intake')).rows[0].total;
    await db.exec(migration);
    assert.equal((await db.query('select user_id from festival_private.organizer_account')).rows[0].user_id, owner);
    assert.equal((await db.query('select count(*)::integer as total from public.festival_intake')).rows[0].total, beforeCount);
  });

  it('rejects unexpected existing policies instead of silently opening more access', async () => {
    await db.exec('create policy "Unexpected public read" on public.festival_intake for select to anon using(true);');
    await assert.rejects(db.exec(migration), /Unexpected festival_intake policies/);
    await db.exec('rollback; drop policy "Unexpected public read" on public.festival_intake;');
  });
});
