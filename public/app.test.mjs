import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './app.mjs';

const KEY = 'k'.repeat(24);
async function boot() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'op-pub-'));
  const app = createApp({ dataDir, adminKey: KEY, webDir: path.resolve('web') });
  const srv = app.server(); await new Promise(r => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const guest = () => {   // a guest = a cookie jar
    let cookie = '';
    return async (p, body, method) => {
      const r = await fetch(base + p, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
      const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
      return { status: r.status, body: await r.json().catch(() => null) };
    };
  };
  const admin = async (p, body, method, raw) => {
    const r = await fetch(base + p, { method: method || (body || raw ? 'POST' : 'GET'), headers: { 'x-admin-key': KEY, ...(raw ? {} : { 'content-type': 'application/json' }) }, body: raw || (body ? JSON.stringify(body) : undefined) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { base, guest, admin, close: () => { srv.close(); app.flush(); fs.rmSync(dataDir, { recursive: true, force: true }); } };
}

test('entries, one vote each, no self votes', async () => {
  const t = await boot(); const a = t.guest(), b = t.guest();
  assert.equal((await a('/api/entry', { name: 'Ann', costume: 'Ghost' })).status, 200);
  await a('/api/entry', { name: 'Ann', costume: 'Big Ghost' });   // edits, does not duplicate
  await b('/api/entry', { name: 'Bob', costume: 'Mummy' });
  assert.equal((await t.admin('/admin/state')).body.entries.length, 2);
  assert.equal((await a('/api/entry', { name: '', costume: 'x' })).status, 400);
  assert.equal((await a('/api/entries')).body.entries.length, 0, 'hidden until voting opens');
  assert.equal((await a('/api/vote', { entryId: 'x' })).status, 403);
  await t.admin('/admin/config', { votingOpen: true, entriesOpen: false }, 'PUT');
  assert.equal((await b('/api/entry', { name: 'Bob', costume: 'New' })).status, 403, 'no edits once entries close');
  t.close();
});

test('voting rules', async () => {
  const t = await boot(); const a = t.guest(), b = t.guest(), c = t.guest();
  await a('/api/entry', { name: 'Ann', costume: 'Ghost' }); await b('/api/entry', { name: 'Bob', costume: 'Mummy' });
  await t.admin('/admin/config', { votingOpen: true }, 'PUT');
  const list = (await c('/api/entries')).body.entries; const ann = list.find(e => e.name === 'Ann'), bob = list.find(e => e.name === 'Bob');
  assert.equal((await a('/api/vote', { entryId: ann.id })).status, 403, 'self vote');
  assert.equal((await c('/api/vote', { entryId: ann.id })).body.me.vote, ann.id);
  assert.equal((await c('/api/vote', { entryId: bob.id })).body.me.vote, bob.id, 'switching replaces');
  await a('/api/vote', { entryId: bob.id });
  const st = (await t.admin('/admin/state')).body;
  assert.equal(st.ranking[0].name, 'Bob'); assert.equal(st.ranking[0].votes, 2); assert.equal(st.totals.votes, 2);
  assert.equal((await c('/api/results')).status, 403);
  await t.admin('/admin/config', { showResults: true }, 'PUT');
  assert.equal((await c('/api/results')).body.results[0].rank, 1);
  await c('/api/vote', { entryId: bob.id }); await c('/api/vote', { entryId: ann.id });   // ann 1 vote, bob 1 vote: a tie
  assert.deepEqual((await c('/api/results')).body.results.map(r => r.rank), [1, 1], 'ties share a numeric rank');
  t.close();
});

test('rating follows the song the hub reports', async () => {
  const t = await boot(); const a = t.guest();
  assert.equal((await a('/api/rate', { trackId: 's1', stars: 5 })).status, 409);
  await t.admin('/admin/now', { track: { id: 's1', title: 'Song', artists: ['X'], art: 'https://i.scdn.co/a.jpg' } }, 'PUT');
  assert.equal((await a('/api/rate', { trackId: 's1', stars: 9 })).status, 400);
  assert.equal((await a('/api/rate', { trackId: 's1', stars: 4 })).body.rating.mine, 4);
  await a('/api/rate', { trackId: 's1', stars: 2 });   // re-rating replaces
  const songs = (await t.admin('/admin/state')).body.songs;
  assert.equal(songs[0].count, 1); assert.equal(songs[0].avg, 2);
  await t.admin('/admin/now', { track: { id: 's2', title: 'Next', artists: [], art: 'javascript:alert(1)' } }, 'PUT');
  assert.equal((await a('/api/public')).body.now.art, '', 'non-https art dropped');
  assert.equal((await a('/api/rate', { trackId: 's1', stars: 5 })).status, 200, 'previous song still rateable for a bit');
  t.close();
});

test('admin auth, images and pay config', async () => {
  const t = await boot(); const a = t.guest();
  assert.equal((await a('/admin/state')).status, 401);
  assert.equal((await t.guest()('/admin/config', { payUrl: 'https://venmo.com/u/x' }, 'PUT')).status, 401);
  await a('/api/entry', { name: 'Ann', costume: 'Ghost' });
  const id = (await t.admin('/admin/state')).body.entries[0].id;
  assert.equal((await t.admin(`/admin/entries/${id}/image`, null, 'POST', Buffer.from('<svg onload=alert(1)>'.padEnd(40)))).status, 415);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const up = await t.admin(`/admin/entries/${id}/image`, null, 'POST', png); assert.equal(up.status, 200);
  assert.equal((await fetch(t.base + up.body.url)).status, 200);
  assert.equal((await fetch(t.base + '/img/..%2Fdata.json')).status, 404);
  assert.equal((await t.admin('/admin/config', { payUrl: 'javascript:1' }, 'PUT')).status, 400);
  assert.equal((await a('/api/public')).body.pay, null);
  await t.admin('/admin/config', { payUrl: 'https://venmo.com/u/me', payNote: '$3 a cup' }, 'PUT');
  assert.equal((await a('/api/public')).body.pay.url, 'https://venmo.com/u/me');
  assert.equal((await t.admin('/admin/pay-image', null, 'POST', png)).status, 200);
  assert.match((await a('/api/public')).body.pay.image, /^\/img\//);
  assert.equal((await t.admin(`/admin/entries/${id}`, null, 'DELETE')).status, 200);
  t.close();
});

test('static page has a CSP and path traversal is refused', async () => {
  const t = await boot();
  const r = await fetch(t.base + '/'); assert.equal(r.status, 200); assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal((await fetch(t.base + '/..%2fapp.mjs')).status, 404);
  t.close();
});

test('guests can add, replace and remove their own costume photo', async () => {
  const t = await boot(); const a = t.guest();
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
  const post = async (cookieFn, buf) => { const r = await fetch(t.base + '/api/photo', { method: 'POST', headers: { 'content-type': 'image/png', cookie: cookieFn }, body: buf }); return { status: r.status, body: await r.json() }; };
  // need the guest's cookie: make an entry through the helper, then reuse its cookie
  let cookie = ''; const r0 = await fetch(t.base + '/api/entry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ann', costume: 'Ghost' }) });
  cookie = r0.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('', png)).status, 404, 'no entry yet for a cookie-less guest');
  const up = await post(cookie, png); assert.equal(up.status, 200); assert.match(up.body.me.entry.image, /^\/img\/[a-f0-9]+\.png$/);
  assert.equal((await post(cookie, Buffer.from('<svg onload=1>'.padEnd(40)))).status, 415);
  const again = await post(cookie, png); assert.notEqual(again.body.me.entry.image, up.body.me.entry.image, 'replaced');
  assert.equal((await fetch(t.base + up.body.me.entry.image)).status, 404, 'old file removed');
  assert.equal((await t.admin('/admin/config', { entriesOpen: false }, 'PUT')).status, 200);
  assert.equal((await post(cookie, png)).status, 403, 'closed');
  t.close();
});
