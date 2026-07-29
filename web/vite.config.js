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
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 4320,
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
