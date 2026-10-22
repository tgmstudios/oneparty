import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../public/app.mjs';
import { createContest, normalizeUrl } from './contest.mjs';

const KEY = 'secret-key-'.repeat(3);
async function boot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'op-hub-'));
  const app = createApp({ dataDir: path.join(dir, 'cloud'), adminKey: KEY, webDir: path.resolve('public/web') });
  const srv = app.server(); await new Promise(r => srv.listen(0, r));
  const url = 'http://127.0.0.1:' + srv.address().port;
  let track = { id: 't1', title: 'Song One', artists: ['A'], art: 'https://i.scdn.co/x.jpg', playing: true };
  let changes = 0;
  const hub = createContest({ imgDir: path.join(dir, 'img'), onChange: () => changes++, getTrack: () => track, env: {} });
  return { hub, url, setTrack: t => { track = t; }, changes: () => changes, dir, close: () => { srv.close(); app.flush(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
const guest = async (url, p, body) => { const r = await fetch(url + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }); return r.json(); };

test('normalizeUrl', () => {
  assert.equal(normalizeUrl('party.example.com/'), 'https://party.example.com');
  assert.equal(normalizeUrl('http://10.0.0.5:8080/x/'), 'http://10.0.0.5:8080/x');
  assert.equal(normalizeUrl('not a url'), '');
});

test('connect, push the playing song, manage entries, never leak the key', async () => {
  const t = await boot();
  assert.match((await t.hub.command({ action: 'connect', url: t.url, key: 'wrong' })).error, /rejected the admin key/);
  assert.deepEqual(await t.hub.command({ action: 'connect', url: t.url, key: KEY }), { ok: true });
  let v = t.hub.view();
  assert.equal(v.connected, true); assert.equal(v.now.id, 't1', 'song reported to the guest app'); assert.equal(v.keySet, true);
  assert.ok(!JSON.stringify(v).includes(KEY), 'key must not be in published state');

  const pub = await guest(t.url, '/api/public'); assert.equal(pub.now.title, 'Song One');
  t.setTrack({ id: 't2', title: 'Song Two', artists: ['B'], art: '', playing: true }); await t.hub.refresh();
  assert.equal(t.hub.view().now.id, 't2');

  await t.hub.command({ action: 'addEntry', name: 'Ann', costume: 'Ghost' });
  await t.hub.command({ action: 'addEntry', name: 'Bo', costume: 'Mummy' });
  v = t.hub.view(); assert.equal(v.entries.length, 2);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
  assert.deepEqual(await t.hub.saveImage('entry', v.entries[0].id, png, 'image/png'), { ok: true });
  v = t.hub.view(); assert.match(v.entries[0].imageUrl, /^\/contest\/[a-f0-9]+\.png$/, 'displays get the local copy');
  assert.ok(fs.existsSync(path.join(t.dir, 'img', v.entries[0].imageUrl.split('/').pop())));
  assert.match((await t.hub.saveImage('entry', v.entries[0].id, png, 'image/svg+xml')).error, /jpg, png/);

  await t.hub.command({ action: 'config', payUrl: 'https://venmo.com/u/me' });
  assert.equal(t.hub.view().config.payUrl, 'https://venmo.com/u/me');
  assert.match((await t.hub.command({ action: 'config', payUrl: 'javascript:1' })).error, /https/);
  await t.hub.command({ action: 'removeEntry', id: v.entries[1].id }); assert.equal(t.hub.view().entries.length, 1);
  t.close();
});

test('leaderboard reveal counts up and clamps', async () => {
  const t = await boot();
  await t.hub.command({ action: 'connect', url: t.url, key: KEY });
  await t.hub.command({ action: 'board', on: true, top: 3, reveal: 'none' });
  for (let i = 0; i < 5; i++) await t.hub.command({ action: 'board', reveal: 'next' });
  assert.equal(t.hub.view().board.reveal, 3);
  await t.hub.command({ action: 'board', reveal: 'none', on: false });
  const v = t.hub.view(); assert.equal(v.board.on, false); assert.equal(v.board.reveal, 0);
  assert.equal(JSON.stringify(t.hub.settings().board.top), '3');
  t.close();
});

test('unconfigured hub is quiet', async () => {
  const hub = createContest({ imgDir: path.join(os.tmpdir(), 'op-x'), onChange() {}, getTrack: () => null, env: {} });
  await hub.refresh(); assert.equal(hub.view().connected, false); assert.equal(hub.view().error, '');
  assert.match((await hub.command({ action: 'config', title: 'x' })).error, /not connected/);
});
