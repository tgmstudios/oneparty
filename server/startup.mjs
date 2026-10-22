import net from 'node:net';

// Check before initializing capture, timers, or integrations in a duplicate process.
export async function checkStartup({ port, host, slug, launch = false }) {
  try {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', reject);
      probe.listen({ port, host, exclusive: true }, () => probe.close(resolve));
    });
    return { reuse: false };
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
  }

  const base = `http://127.0.0.1:${port}`;
  let state;
  try {
    const response = await fetch(base + '/api/state', { signal: AbortSignal.timeout(2000) });
    if (response.ok) state = await response.json();
  } catch { /* An unrelated service may not speak HTTP or expose this endpoint. */ }
  if (!state?.event?.slug || !Array.isArray(state.scenes) || !state.channels || typeof state.channels !== 'object') {
    throw new Error(`Port ${port} is already in use by another service. Stop that service or run: npm start -- --port ${port + 1}`);
  }
  if (state.event.slug !== slug) {
    throw new Error(`Port ${port} is running oneparty event "${state.event.slug}", not "${slug}". Stop that hub first, or choose another port with --port ${port + 1}.`);
  }
  if (launch) {
    const response = await fetch(base + '/api/launch', {
      method: 'POST', body: JSON.stringify({ force: false }), signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok || result?.error || result?.ok === false) throw new Error(`The hub is already running, but display launch failed: ${result?.error || response.status}`);
  }
  return { reuse: true, controlUrl: base + '/control.html' };
}
