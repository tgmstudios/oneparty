export function createKioskStream() {
  let frame = null, at = 0;
  const viewers = new Set();
  return {
    status: () => ({ at, viewers: viewers.size, bytes: frame?.length || 0 }),
    push(bytes) {
      if (bytes.length < 4 || bytes.length > 1_000_000 || bytes[0] !== 255 || bytes[1] !== 216) return false;
      frame = bytes; at = Date.now();
      for (const res of viewers) if (!res.writableNeedDrain) res.write(Buffer.concat([Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`), frame, Buffer.from('\r\n')]));
      return true;
    },
    still(res) {
      if (!frame) { res.writeHead(503); return res.end('Renderer starting'); }
      res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store' }); res.end(frame);
    },
    stream(req, res) {
      res.writeHead(200, { 'content-type': 'multipart/x-mixed-replace; boundary=frame', 'cache-control': 'no-store' });
      res.flushHeaders(); viewers.add(res); req.on('close', () => viewers.delete(res));
    },
  };
}
