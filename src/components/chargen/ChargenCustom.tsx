/**
 * ChargenCustom — generic character creator for the "custom" ruleset.
 * Free-form sheet with weighted randomization via WEIGHT_PROFILES.
 */
import { useState } from 'react';
import { characterSchema } from '../../lib/schemas';
import { newId, saveCharacter } from '../../lib/storage';
import { addCharacterToActiveCampaign } from '../../lib/storageHelpers';
import { abilityModifier, formatModifier } from '../../lib/dice';
import { WEIGHT_PROFILES, weightedRandomize } from '../../lib/chargen';
import type { ChargenProps } from './types';

const ATTR_KEYS   = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ATTR_LABELS: Record<typeof ATTR_KEYS[number], string> = {
  str: 'Attr 1', dex: 'Attr 2', con: 'Attr 3',
  int: 'Attr 4', wis: 'Attr 5', cha: 'Attr 6',
};
type Attrs = Record<typeof ATTR_KEYS[number], number>;

function emptyAttrs(val = 10): Attrs {
  return { str: val, dex: val, con: val, int: val, wis: val, cha: val };
}

export default function ChargenCustom({ onCreated }: ChargenProps) {
  const [profileId, setProfileId]         = useState('balanced');
  const [randomizeNote, setRandomizeNote] = useState('');

  const [form, setForm] = useState({
    characterName: '',
    playerName: '',
    race: 'Unknown',
    class: 'Adventurer',
    background: '',
    alignment: '',
    level: 1,
    abilityScores: emptyAttrs(10),
    armorClass: 10,
    speed: 30,
    hitPointMaximum: 10,
    currentHitPoints: 10,
    equipment: '',
    traits: '',
    ideals: '',
    bonds: '',
    flaws: '',
  });
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }
  function setAttr(key: typeof ATTR_KEYS[number], value: number) {
    setForm(f => ({ ...f, abilityScores: { ...f.abilityScores, [key]: value } }));
  }

  function handleRandomize() {
    const profile = WEIGHT_PROFILES.find(p => p.id === profileId) ?? WEIGHT_PROFILES[0];
    // Use a generic class name that falls back to DEFAULT_PRIORITY in weightedRandomize
    const result = weightedRandomize('Custom', form.level, profile);
    setForm(f => ({ ...f, abilityScores: result.scores }));
    setRandomizeNote(result.detail);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const now = new Date().toISOString();
    const candidate = {
      ...form,
      id: newId(),
      proficiencyBonus: Math.ceil(form.level / 4) + 1,
      temporaryHitPoints: 0,
      source: 'manual' as const,
      createdAt: now,
    };
    const parsed = characterSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
    saveCharacter(parsed.data);
    addCharacterToActiveCampaign({
      id: parsed.data.id,
      characterName: parsed.data.characterName,
      class: parsed.data.class,
      level: parsed.data.level,
    });
    setError(null);
    onCreated(parsed.data);
  }

  const activeProfile = WEIGHT_PROFILES.find(p => p.id === profileId) ?? WEIGHT_PROFILES[0];

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Identity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label htmlFor="cc-name" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Character Name *</label><input id="cc-name" required className="input" value={form.characterName} onChange={e => set('characterName', e.target.value)} placeholder="e.g. Kael" /></div>
        <div><label htmlFor="cc-player" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Player Name</label><input id="cc-player" className="input" value={form.playerName} onChange={e => set('playerName', e.target.value)} placeholder="Your name" /></div>
      </div>

      {/* Species / Role / Level */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 'var(--space-3)' }}>
        <div><label htmlFor="cc-race" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Species / Origin</label><input id="cc-race" className="input" value={form.race} onChange={e => set('race', e.target.value)} placeholder="Human, Elf, etc." /></div>
        <div><label htmlFor="cc-class" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Class / Role</label><input id="cc-class" className="input" value={form.class} onChange={e => set('class', e.target.value)} placeholder="Warrior, Mage, etc." /></div>
        <div><label htmlFor="cc-level" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Level</label><input id="cc-level" type="number" min={1} max={99} className="input" value={form.level} onChange={e => set('level', Number(e.target.value))} /></div>
      </div>

      {/* Combat stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label htmlFor="cc-ac" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Armor Class</label><input id="cc-ac" type="number" min={0} max={40} className="input" value={form.armorClass} onChange={e => set('armorClass', Number(e.target.value))} /></div>
        <div><label htmlFor="cc-hp" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Max HP</label><input id="cc-hp" type="number" min={1} max={9999} className="input" value={form.hitPointMaximum} onChange={e => { set('hitPointMaximum', Number(e.target.value)); set('currentHitPoints', Number(e.target.value)); }} /></div>
        <div><label htmlFor="cc-spd" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Speed</label><input id="cc-spd" type="number" min={0} max={999} className="input" value={form.speed} onChange={e => set('speed', Number(e.target.value))} /></div>
      </div>

      {/* Attributes + Weighted Randomize */}
      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Attributes</legend>

        {/* Randomize bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
          padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-offset)', border: '1px solid var(--color-border)',
          marginBottom: 'var(--space-3)',
        }}>
          <label htmlFor="cc-profile" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>Weight Profile</label>
          <select
            id="cc-profile"
            className="input"
            value={profileId}
            onChange={e => setProfileId(e.target.value)}
            style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', flex: '0 0 auto', minWidth: 120 }}
          >
            {WEIGHT_PROFILES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flex: 1, minWidth: 0 }}>
            {activeProfile.description}
          </span>
          <button
            type="button"
            className="btn btn-gold"
            onClick={handleRandomize}
            style={{ whiteSpace: 'nowrap' }}
            title={`Roll 4d6 drop lowest with ${activeProfile.label} weighting`}
          >
            🎲 Randomize
          </button>
        </div>
        {randomizeNote && <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{randomizeNote}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          {ATTR_KEYS.map(k => {
            const val = form.abilityScores[k];
            return (
              <div key={k}>
                <label htmlFor={`cc-${k}`} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 'var(--space-1)' }}>{ATTR_LABELS[k]}</label>
                <input id={`cc-${k}`} type="number" min={1} max={99} className="input" value={val} onChange={e => setAttr(k, Number(e.target.value))} />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-1)' }}>{formatModifier(abilityModifier(val))}</div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Background / Notes */}
      <div><label htmlFor="cc-bg" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Background / Origin</label><input id="cc-bg" className="input" value={form.background} onChange={e => set('background', e.target.value)} placeholder="Brief background" /></div>
      <div><label htmlFor="cc-traits" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Notes / Traits</label><textarea id="cc-traits" className="input" rows={3} maxLength={2000} value={form.traits} onChange={e => set('traits', e.target.value)} style={{ resize: 'vertical' }} placeholder="Personality, quirks, special abilities, equipment…" /></div>

      {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>Create Character</button>
    </form>
  );
}
