import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-oxc';

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
    hmr: { overlay: true },
  },
});
