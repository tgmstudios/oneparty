// QR code as an SVG data: URI, using the vendored qrcode-generator the control panel already ships (web/vendor/qrcode.js, UMD).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'vendor', 'qrcode.js');
let factory;
export function qrDataUri(text) {
  try {
    if (!factory) { const m = { exports: {} }; new Function('module', 'exports', fs.readFileSync(src, 'utf8'))(m, m.exports); factory = m.exports; }
    const q = factory(0, 'M'); q.addData(String(text)); q.make();
    return 'data:image/svg+xml;base64,' + Buffer.from(q.createSvgTag({ cellSize: 8, margin: 2, scalable: true })).toString('base64');
  } catch { return ''; }
}
