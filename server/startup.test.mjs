import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { checkStartup } from './startup.mjs';

async function service(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return server.address().port;
}
const hubState = { event: { slug: 'halloween' }, scenes: [], channels: {} };
const json = (res, body) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); };

test('available port permits a fresh startup and releases the probe', async () => {
  assert.deepEqual(await checkStartup({ port: 0, host: '127.0.0.1', slug: 'halloween' }), { reuse: false });
});
test('same event reuses its running hub', async t => {
  const port = await service(t, (_req, res) => json(res, hubState));
  assert.deepEqual(await checkStartup({ port, host: '127.0.0.1', slug: 'halloween' }), {
    reuse: true, controlUrl: `http://127.0.0.1:${port}/control.html`,
  });
});
test('an unrelated listener gives an actionable error', async t => {
  const port = await service(t, (_req, res) => { res.statusCode = 404; res.end('Other app'); });
  await assert.rejects(checkStartup({ port, host: '127.0.0.1', slug: 'halloween' }), /already in use by another service.*--port/);
});
test('a different event is not silently reused', async t => {
  const port = await service(t, (_req, res) => json(res, hubState));
  await assert.rejects(checkStartup({ port, host: '127.0.0.1', slug: 'birthday' }), /halloween.*not "birthday"/);
});
test('party forwards launch without forcing replacement windows', async t => {
  let launches = 0;
  const port = await service(t, async (req, res) => {
    if (req.url === '/api/launch') {
      assert.equal(req.method, 'POST');
      let body = ''; for await (const chunk of req) body += chunk;
      assert.deepEqual(JSON.parse(body), { force: false }); launches++; json(res, []);
    } else json(res, hubState);
  });
  await checkStartup({ port, host: '127.0.0.1', slug: 'halloween', launch: true });
  assert.equal(launches, 1);
});
test('launch failures are reported', async t => {
  const port = await service(t, (req, res) => {
    if (req.url === '/api/launch') { res.statusCode = 500; json(res, { error: 'display unavailable' }); }
    else json(res, hubState);
  });
  await assert.rejects(checkStartup({ port, host: '127.0.0.1', slug: 'halloween', launch: true }), /display launch failed: display unavailable/);
});
