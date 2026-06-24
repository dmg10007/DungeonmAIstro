import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['dompurify'],
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  server: {
    host: true,
    https: true,
    hmr: { overlay: true },
    allowedHosts: ['personal-laptop.taila7fb53.ts.net'],
  },
});
