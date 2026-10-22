import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// The panel is served by the hub at /control/ (built into web/control). In dev, `npm run control:dev` proxies the API to a running hub.
const HUB = process.env.ONEPARTY_URL || 'http://127.0.0.1:8787';
export default defineConfig({
  root: import.meta.dirname,
  base: '/control/',
  plugins: [vue()],
  build: { outDir: '../web/control', emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': HUB, '/auth': HUB, '/cache': HUB, '/media': HUB } },
});
