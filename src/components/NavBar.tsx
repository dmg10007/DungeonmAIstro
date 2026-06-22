import { Link, NavLink } from 'react-router-dom';
import { useCallback } from 'react';

export default function NavBar() {
  const toggleTheme = useCallback(() => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') ?? 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('dmg_theme', next);
  }, []);

  return (
    <header style={styles.header}>
      <Link to="/" style={styles.logo} aria-label="DungeonmAIstro home">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="var(--color-primary)"/>
          <polygon
            points="16,5 20,13 29,13 22,19 25,27 16,22 7,27 10,19 3,13 12,13"
            fill="var(--color-gold)" stroke="var(--color-gold)" strokeWidth="0.5"
          />
        </svg>
        <span style={styles.logoText}>DungeonmAIstro</span>
      </Link>

      <nav aria-label="Main navigation" style={styles.nav}>
        {[
          { to: '/',          label: 'Home'      },
          { to: '/setup',     label: 'New Game'  },
          { to: '/character', label: 'Characters'},
          { to: '/play',      label: 'Play'      },
          { to: '/settings',  label: 'Settings'  },
        ].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              ...styles.navLink,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: isActive ? '600' : '400',
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={toggleTheme}
        aria-label="Toggle light/dark mode"
        data-theme-toggle
        style={styles.themeBtn}
      >
        <ThemeIcon />
      </button>
    </header>
  );
}

function ThemeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    padding: 'var(--space-3) var(--space-6)',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-divider)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    textDecoration: 'none',
    color: 'var(--color-text)',
    flexShrink: 0,
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--text-sm)',
    fontWeight: '700',
    letterSpacing: '0.04em',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginLeft: 'auto',
    flexWrap: 'wrap',
  },
  navLink: {
    textDecoration: 'none',
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--text-xs)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    transition: 'color var(--transition-interactive), background var(--transition-interactive)',
  },
  themeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--color-text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: 'var(--radius-md)',
    flexShrink: 0,
  },
};
