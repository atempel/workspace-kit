import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The dashboard never reaches the filesystem itself — it reads `core/server.js`
 * over HTTP, which is what keeps the CLI and the Web App answering identically
 * (docs/specs/web-app-dashboard.md → #169). In development Vite proxies /api to
 * that server, so the browser stays on one origin.
 *
 * Start the data side first:  node bin/workspace-kit.js serve .
 *
 * Ports are 4330 (dev) / 4331 (preview) rather than the 4320/4321 pair next to
 * the API. The parallel `app/` implementation on branch `worktree-dashboard`
 * uses 4320 and 4321 with those two swapped, so while both exist and can be
 * compared side by side, sharing the range meant one silently answering for the
 * other. `strictPort` is what turns that into a visible failure instead.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bind explicitly to 127.0.0.1. Vite's default `localhost` resolves to ::1
  // here, and Node's fetch (unlike curl, which falls back) then gets
  // ECONNREFUSED — so the API server, the front end and any check script all
  // agree on one address instead of silently disagreeing.
  server: {
    host: '127.0.0.1',
    port: 4330,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4319',
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4331,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4319',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
