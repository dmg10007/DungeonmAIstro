import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/base.css';
import { pruneExpired } from './lib/vault';

// Apply saved theme before first paint to avoid flash
(function initTheme() {
  const saved = localStorage.getItem('dmg_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved ?? (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

// Prune any expired API keys silently
try { pruneExpired(); } catch { /* vault may be empty on first load */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
