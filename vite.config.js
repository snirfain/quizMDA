import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { extractDocHandler } from './server/docExtract.js';

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
  ],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
