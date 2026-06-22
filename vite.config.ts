import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // unsafe-eval needed by Vite HMR in dev
        "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com",
        "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws://localhost:* http://localhost:* https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://cdnjs.cloudflare.com",
        "worker-src blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
  },
});
