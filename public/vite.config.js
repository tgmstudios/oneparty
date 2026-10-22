import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Source in src/ (+ index.html); the build lands in web/, which server.mjs serves. static/ (fonts, qrcode.js) is copied through as-is so URLs stay /fonts/... and /qrcode.js.
export default defineConfig({
  plugins: [vue()],
  publicDir: 'static',
  build: { outDir: 'web', emptyOutDir: true, assetsInlineLimit: 0, modulePreload: { polyfill: false } },   // no inline scripts or data: assets (CSP)
  server: { port: 5174, proxy: { '/api': 'http://localhost:8080', '/admin': 'http://localhost:8080', '/img': 'http://localhost:8080' } },
});
