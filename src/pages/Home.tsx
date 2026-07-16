import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listCampaigns, deleteCampaign, setActiveCampaignId, type CampaignSummary } from '../lib/storage';

export default function Home() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>(() => listCampaigns());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleResume(id: string) {
    setActiveCampaignId(id);
    navigate('/play');
  }

  function handleDeleteRequest(id: string) {
    setConfirmDeleteId(id);
  }

  function handleDeleteConfirm() {
    if (!confirmDeleteId) return;
    deleteCampaign(confirmDeleteId);
    setCampaigns(listCampaigns());
    setConfirmDeleteId(null);
  }

  function handleDeleteCancel() {
    setConfirmDeleteId(null);
  }

  return (
    <div style={{
      maxWidth: 'var(--content-default)', margin: '0 auto',
      padding: 'var(--space-16) var(--space-6)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
      gap: 'var(--space-8)',
    }}>
      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
        <svg width="72" height="72" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <polygon points="16,2 30,28 2,28" fill="none" stroke="var(--color-primary)" strokeWidth="2"/>
          <circle cx="16" cy="18" r="4" fill="var(--color-gold)"/>
          <line x1="16" y1="8" x2="16" y2="14" stroke="var(--color-primary)" strokeWidth="1.5"/>
        </svg>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--color-primary)' }}>
          DungeonmAIstro
        </h1>
        <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-muted)', maxWidth: '55ch' }}>
          Your AI-powered Dungeon Master for D&amp;D 5e — from your first character to the final boss.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/setup" className="btn btn-primary" style={{ fontSize: 'var(--text-base)' }}>Begin a New Adventure</Link>
          <Link to="/characters" className="btn btn-ghost" style={{ fontSize: 'var(--text-base)' }}>Manage Characters</Link>
        </div>
      </div>

      {/* Feature cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
        gap: 'var(--space-4)', width: '100%', textAlign: 'left',
      }}>
        {[
          { icon: '\uD83D\uDDFA', title: 'Full Campaigns', desc: 'One-shots or multi-session epics \u2014 generated to your prompt.' },
          { icon: '\uD83C\uDFB2', title: 'Dice Engine', desc: 'Every die in 5e: d4 through d100 with advantage/disadvantage.' },
          { icon: '\uD83D\uDCDC', title: 'Character Lab', desc: 'Build from scratch or import a filled PDF character sheet.' },
          { icon: '\uD83E\uDDE0', title: 'Persistent Memory', desc: 'The DM remembers every choice, roll, and NPC across sessions.' },
        ].map(f => (
          <div key={f.title} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{f.icon}</span>
            <h3 style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-display)' }}>{f.title}</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Saved campaigns */}
      {campaigns.length > 0 && (
        <div style={{ width: '100%', textAlign: 'left' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-display)', marginBottom: 'var(--space-4)' }}>Continue a Campaign</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {campaigns.map(c => (
              <div
                key={c.id}
                className="card"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {c.mode === 'one_shot' ? 'One-shot' : 'Campaign'} — {new Date(c.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                {confirmDeleteId === c.id ? (
                  // Inline confirmation
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', whiteSpace: 'nowrap' }}>Delete forever?</span>
                    <button
                      className="btn"
                      style={{
                        fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-3)',
                        background: 'var(--color-error)', color: '#fff', borderRadius: 'var(--radius-md)',
                      }}
                      onClick={handleDeleteConfirm}
                    >
                      Yes, delete
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-3)' }}
                      onClick={handleDeleteCancel}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 'var(--text-sm)' }}
                      onClick={() => handleResume(c.id)}
                    >
                      Resume
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-error)',
                        padding: 'var(--space-1) var(--space-2)',
                      }}
                      aria-label={`Delete campaign ${c.title}`}
                      onClick={() => handleDeleteRequest(c.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
