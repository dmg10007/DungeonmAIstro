import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
  ],
  optimizeDeps: {
    include: ['dompurify'],
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  server: {
    host: true,
    hmr: { overlay: true },
    allowedHosts: ['personal-laptop.taila7fb53.ts.net'],
  },
});
