import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/setup', label: 'New Adventure' },
  { to: '/characters', label: 'Characters' },
  { to: '/play', label: 'Play' },
  { to: '/combat', label: 'Combat' },
  { to: '/knowledge', label: 'Knowledge' },
  { to: '/settings', label: 'Settings' },
];

export default function NavBar() {
  const location = useLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('dm_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dm_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-divider)',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <nav style={{
        maxWidth: 'var(--content-wide)', margin: '0 auto',
        padding: 'var(--space-3) var(--space-6)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-6)',
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="DungeonmAIstro logo">
            <polygon points="16,2 30,28 2,28" fill="none" stroke="var(--color-primary)" strokeWidth="2"/>
            <circle cx="16" cy="18" r="4" fill="var(--color-gold)"/>
            <line x1="16" y1="8" x2="16" y2="14" stroke="var(--color-primary)" strokeWidth="1.5"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--color-primary)', fontWeight: 700 }}>
            DungeonmAIstro
          </span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto', alignItems: 'center' }}
          className="desktop-nav">
          {NAV_LINKS.map(l => (
            <Link key={l.to} to={l.to} style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              color: location.pathname === l.to ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: location.pathname === l.to ? 'var(--color-primary-highlight)' : 'transparent',
              transition: 'all var(--transition-interactive)',
            }}>{l.label}</Link>
          ))}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)' }}
          >
            {theme === 'dark'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle navigation menu"
          style={{ marginLeft: 'auto', padding: 'var(--space-2)', color: 'var(--color-text)' }}
          className="mobile-menu-btn"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div style={{
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-divider)',
          padding: 'var(--space-3) var(--space-6)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
        }}>
          {NAV_LINKS.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              color: location.pathname === l.to ? 'var(--color-primary)' : 'var(--color-text)',
              background: location.pathname === l.to ? 'var(--color-primary-highlight)' : 'transparent',
            }}>{l.label}</Link>
          ))}
        </div>
      )}

      <style>{`
        .mobile-menu-btn { display: none; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
