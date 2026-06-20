import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import UnoCSS from 'unocss/vite';
import { resolve } from 'node:path';

// Build into ../dist so the backend's staticPlugin({ assets: 'dist' }) serves
// us directly. Dev server proxies /api → backend on :8000.
export default defineConfig({
  plugins: [UnoCSS(), svelte()],
  resolve: {
    alias: { $lib: resolve(__dirname, 'src/lib') },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/blobs': 'http://127.0.0.1:8000',
      '/thumbnails': 'http://127.0.0.1:8000',
    },
  },
});
