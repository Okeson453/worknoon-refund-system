import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    // `npm run dev` resolves the real presenter overlay (src/dev/*Switch.tsx); `npm run build` resolves
    // the *.prod.tsx stubs, so the overlay is never part of the image reviewers run.
    conditions: mode === 'production' ? ['production'] : [],
    alias: {
      '@worknoon/shared-types': fileURLToPath(new URL('../../packages/shared-types/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Local development talks to the Express API; production is same-origin through nginx.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_URL ?? 'http://localhost:8080',
        changeOrigin: false,
      },
    },
    fs: {
      allow: ['../..'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
}));
