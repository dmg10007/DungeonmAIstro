import { useState, useEffect } from 'react';
import CombatTracker from '../components/CombatTracker';
import DiceRoller from '../components/DiceRoller';
import { loadCampaign, saveCampaign } from '../lib/storage';
import { logDiceRoll } from '../lib/combat';
import type { CampaignState, DiceRollResult } from '../lib/schemas';

export default function Combat() {
  const [campaign, setCampaign] = useState<CampaignState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const c = loadCampaign();
    setCampaign(c);
    setLoading(false);
  }, []);

  function handleCampaignUpdate(updated: CampaignState) {
    setCampaign(updated);
    saveCampaign(updated);
  }

  function handleRoll(result: DiceRollResult) {
    if (!campaign) return;
    const updated = logDiceRoll(campaign, result);
    handleCampaignUpdate(updated);
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 'var(--content-wide)', margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
        <div className="skeleton" style={{ height: '40px', width: '200px', marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: '300px' }} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ maxWidth: 'var(--content-default)', margin: '0 auto', padding: 'var(--space-16) var(--space-6)', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-4)' }}>🗡️</div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-3)' }}>No Active Campaign</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
          Start a new adventure from the Setup page before entering combat.
        </p>
        <a href="/setup" className="btn btn-primary">Go to Setup</a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 'var(--content-wide)', margin: '0 auto', padding: 'var(--space-6)' }}>
      {/* Page header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>⚔️ Combat</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          {campaign.title} — {campaign.characters.length} party member{campaign.characters.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Two-column layout: tracker + dice */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        gap: 'var(--space-6)',
        alignItems: 'start',
      }}>
        {/* Combat tracker */}
        <CombatTracker campaign={campaign} onCampaignUpdate={handleCampaignUpdate} />

        {/* Dice sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
          }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)', fontWeight: 700 }}>Dice Roller</h2>
            <DiceRoller onRoll={handleRoll} actorType="player" />
          </div>

          {/* Quick reference */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
          }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', marginBottom: 'var(--space-3)', fontWeight: 700 }}>Combat Quick Ref</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {[
                ['Attack Roll', 'd20 + ATK bonus vs AC'],
                ['Death Save', 'd20 — 10+ success, 1 = 2 fails'],
                ['Crit Hit', 'Nat 20 = double damage dice'],
                ['Healing Surge', 'Action: 1d4 + CON mod once/day'],
                ['Disengage', 'Action: move without OA'],
                ['Dash', 'Action: double movement'],
                ['Help', 'Action: ally gets advantage'],
                ['Hide', 'Action: DEX (Stealth) check'],
                ['Shove', 'Athletics vs Athletics/Acrobatics'],
                ['Grapple', 'Athletics vs Athletics/Acrobatics'],
              ].map(([action, rule]) => (
                <div key={action} style={{ display: 'flex', flexDirection: 'column', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-divider)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>{action}</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .combat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
