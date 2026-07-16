/**
 * CharacterLab — thin dispatcher.
 *
 * Reads the active campaign's ruleset and mounts the correct
 * game-specific chargen component via React.lazy.
 * The Randomize button and weight-profile picker live inside each
 * game-specific component so they can be tuned per system.
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Ruleset, Character } from '../lib/schemas';
import { abilityModifier, formatModifier } from '../lib/dice';
import { getActiveCampaignId, loadCampaign } from '../lib/storage';
import { getRulesetChargenConfig } from '../lib/rulesets/chargen';
import type { ChargenProps } from '../components/chargen/types';

const ChargenDnD5e  = lazy(() => import('../components/chargen/ChargenDnD5e'));
const ChargenPF2e   = lazy(() => import('../components/chargen/ChargenPF2e'));
const ChargenCoC7e  = lazy(() => import('../components/chargen/ChargenCoC7e'));
const ChargenSR6e   = lazy(() => import('../components/chargen/ChargenSR6e'));
const ChargenCustom = lazy(() => import('../components/chargen/ChargenCustom'));

function getActiveCampaignRuleset(): Ruleset {
  const id = getActiveCampaignId();
  if (!id) return 'dnd5e';
  const campaign = loadCampaign(id);
  return (campaign?.options?.ruleset as Ruleset) ?? 'dnd5e';
}

export default function CharacterLab() {
  const navigate  = useNavigate();
  const ruleset   = useMemo(getActiveCampaignRuleset, []);
  const cfg       = useMemo(() => getRulesetChargenConfig(ruleset), [ruleset]);

  const [tab, setTab]         = useState<'create' | 'import'>('create');
  const [created, setCreated] = useState<Character | null>(null);

  const handleCreated: ChargenProps['onCreated'] = (char) => setCreated(char);
  function resetForm() { setCreated(null); }

  if (created) {
    return (
      <div style={{
        maxWidth: 'var(--content-narrow)', margin: '0 auto',
        padding: 'var(--space-12) var(--space-6)', textAlign: 'center',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', alignItems: 'center',
      }}>
        <div style={{ fontSize: 'var(--text-xl)', color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
          {created.characterName} is ready!
        </div>
        <div className="card" style={{ width: '100%', textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
            <div><strong>{cfg.speciesLabel}:</strong> {created.race}</div>
            <div><strong>{cfg.classLabel}:</strong> {created.class}</div>
            <div><strong>AC:</strong> {created.armorClass}</div>
            <div><strong>HP:</strong> {created.hitPointMaximum}</div>
            {(Object.keys(created.abilityScores) as (keyof typeof created.abilityScores)[]).map((k, i) => (
              <div key={k}>
                <strong>{cfg.stats[i]?.label ?? k.toUpperCase()}:</strong>{' '}
                {created.abilityScores[k]} ({formatModifier(abilityModifier(created.abilityScores[k]))})
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => navigate('/play')}>Begin Adventure &rarr;</button>
          <button className="btn btn-ghost" onClick={resetForm}>Add Another Character</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 'var(--content-narrow)', margin: '0 auto', padding: 'var(--space-12) var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--color-primary)' }}>Character Lab</h1>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>{cfg.systemName}</div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }} onClick={() => navigate('/play')}>
          Skip &rarr; Play without character
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
        <button className={`btn ${tab === 'create' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('create')}>Create Character</button>
        <button className={`btn ${tab === 'import' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('import')}>Import PDF</button>
      </div>

      {tab === 'import' && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)' }}>
          <div style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-3)' }}>PDF Import</div>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            Upload a filled {cfg.systemName} character sheet PDF.<br />
            PDF parsing coming in a future release.
          </p>
          <input type="file" accept=".pdf" style={{ marginTop: 'var(--space-4)' }}
            aria-label="Upload character sheet PDF"
            onChange={() => alert('PDF parsing will be available shortly.')}
          />
        </div>
      )}

      {tab === 'create' && (
        <Suspense fallback={
          <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Loading character creator…
          </div>
        }>
          {ruleset === 'dnd5e'           && <ChargenDnD5e  onCreated={handleCreated} />}
          {ruleset === 'pathfinder2e'    && <ChargenPF2e   onCreated={handleCreated} />}
          {ruleset === 'callofcthulhu7e' && <ChargenCoC7e  onCreated={handleCreated} />}
          {ruleset === 'shadowrun6e'     && <ChargenSR6e   onCreated={handleCreated} />}
          {ruleset === 'custom'          && <ChargenCustom onCreated={handleCreated} />}
        </Suspense>
      )}
    </div>
  );
}
