// Entry point: node server.mjs   (env: PORT, ADMIN_KEY, DATA_DIR, TRUST_PROXY=1 behind a proxy/CDN)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 8080;
const app = createApp({
  dataDir: path.resolve(process.env.DATA_DIR || path.join(here, 'data')),
  adminKey: process.env.ADMIN_KEY || '',
  webDir: path.join(here, 'web'),
  trustProxy: process.env.TRUST_PROXY === '1',
});
if (!process.env.ADMIN_KEY) console.warn('[warn] ADMIN_KEY is not set: the admin API (used by the hub) is disabled.');
else if (process.env.ADMIN_KEY.length < 16) console.warn('[warn] ADMIN_KEY is short; use 24+ random characters.');
app.server().listen(PORT, () => console.log(`oneparty guest app on :${PORT}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { app.flush(); } finally { process.exit(0); } });
