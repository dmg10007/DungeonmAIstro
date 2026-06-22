import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/base.css';

// Apply stored or system theme before first paint to avoid flash
(function initTheme() {
  const stored = localStorage.getItem('dm-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored ?? (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
