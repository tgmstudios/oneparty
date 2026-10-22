// DDP (Distributed Display Protocol) sender for WLED: realtime pixels over UDP :4048, no Home Assistant round-trip.
// WLED switches to realtime on the first packet and returns to its normal state ~2.5 s after the stream stops.
import dgram from 'node:dgram';

export function createDDP({ log = console.log } = {}) {
  const sock = dgram.createSocket('udp4'); let seq = 0;
  sock.on('error', e => log('[ddp]', e.message));
  sock.unref();
  return {
    /** send `leds` pixels of one color (r,g,b 0-255) */
    solid(ip, leds, [r, g, b]) {
      const n = Math.max(1, Math.min(leds, 480)), buf = Buffer.alloc(10 + n * 3);
      buf[0] = 0x41; buf[1] = (seq = (seq % 15) + 1); buf[2] = 0x01; buf[3] = 0x01;   // flags v1+push, sequence 1-15, RGB, default id
      buf.writeUInt32BE(0, 4); buf.writeUInt16BE(n * 3, 8);
      for (let i = 0; i < n; i++) { buf[10 + i * 3] = r; buf[11 + i * 3] = g; buf[12 + i * 3] = b; }
      sock.send(buf, 4048, ip);
    },
    close() { try { sock.close(); } catch { /* closed */ } },
  };
}
