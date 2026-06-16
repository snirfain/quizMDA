import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractDocHandler } from './server/docExtract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'doc-extract-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== '/api/extract-doc' || req.method !== 'POST') return next();
          try {
            await extractDocHandler(req, res);
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message || 'Server error' }));
          }
        });
      },
    },
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' || req.url == null) return next();
          const url = req.url.split('?')[0];
          if (url === '/' || url.startsWith('/api/') || url.startsWith('/@') || url.startsWith('/node_modules')) return next();
          if (/\.(js|css|mjs|json|ico|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)$/i.test(url)) return next();
          const index = path.join(server.config.root || process.cwd(), 'index.html');
          if (!fs.existsSync(index)) return next();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html');
          fs.createReadStream(index).pipe(res);
        });
      },
    },
  ],
  server: {
    port: 3000,
    open: true,
    // Match production: let Google Sign-In popups postMessage back to the opener.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
