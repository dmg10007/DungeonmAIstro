/**
 * ChargenSR6e — Shadowrun 6e character creator.
 * Uses the Priority system (METATYPE / ATTRIBUTES / MAGIC / SKILLS / RESOURCES).
 */
import { useState } from 'react';
import { characterSchema } from '../../lib/schemas';
import { newId, saveCharacter } from '../../lib/storage';
import { addCharacterToActiveCampaign } from '../../lib/storageHelpers';
import { getRulesetChargenConfig } from '../../lib/rulesets/chargen';
import type { ChargenProps } from './types';

const cfg = getRulesetChargenConfig('shadowrun6e');

type Priority = 'A' | 'B' | 'C' | 'D' | 'E';
type PriorityCategory = 'metatype' | 'attributes' | 'magic' | 'skills' | 'resources';

const PRIORITY_DATA: Record<Priority, { metatype: string; attributes: number; magic: string; skills: number; resources: string }> = {
  A: { metatype: 'Human (9) / Elf (8)',   attributes: 24, magic: 'Full (4) / Tech (4)', skills: 32, resources: '450,000 NY' },
  B: { metatype: 'Dwarf/Ork (7)',          attributes: 20, magic: 'Full (3) / Tech (3)', skills: 24, resources: '275,000 NY' },
  C: { metatype: 'Troll/Human (5)',         attributes: 16, magic: 'Full (2)',             skills: 20, resources: '140,000 NY' },
  D: { metatype: 'Elf/Dwarf (4)',           attributes: 14, magic: 'Adept (2)',            skills: 16, resources: '50,000 NY' },
  E: { metatype: 'Human (1)',               attributes: 12, magic: 'None',                 skills: 10, resources: '8,000 NY' },
};

const PRIORITIES: Priority[] = ['A', 'B', 'C', 'D', 'E'];
const CATEGORIES: PriorityCategory[] = ['metatype', 'attributes', 'magic', 'skills', 'resources'];
const CATEGORY_LABELS: Record<PriorityCategory, string> = {
  metatype: 'Metatype', attributes: 'Attributes', magic: 'Magic / Resonance', skills: 'Skills', resources: 'Resources',
};
type PriorityMap = Record<PriorityCategory, Priority>;
const DEFAULT_PRIORITIES: PriorityMap = { metatype: 'C', attributes: 'B', magic: 'E', skills: 'A', resources: 'D' };

const ATTR_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
type AttrKey = typeof ATTR_KEYS[number];
const ATTR_LABELS: Record<AttrKey, string> = {
  str: 'Body', dex: 'Agility', con: 'Reaction', int: 'Intuition', wis: 'Logic', cha: 'Charisma',
};

function emptyAttrs(val = 1): Record<AttrKey, number> {
  return { str: val, dex: val, con: val, int: val, wis: val, cha: val };
}

// ── Archetype-weighted attribute profiles ─────────────────────────────────────
interface SRProfile { id: string; label: string; desc: string; priority: AttrKey[] }
const SR_PROFILES: SRProfile[] = [
  { id: 'samurai',  label: 'Street Samurai', desc: 'Max Body, Agility, Reaction.',         priority: ['str', 'dex', 'con', 'cha', 'wis', 'int'] },
  { id: 'mage',     label: 'Mage',           desc: 'Max Logic, Intuition, Charisma.',      priority: ['wis', 'int', 'cha', 'con', 'dex', 'str'] },
  { id: 'decker',   label: 'Decker',         desc: 'Max Logic, Intuition, Agility.',       priority: ['wis', 'int', 'dex', 'con', 'cha', 'str'] },
  { id: 'face',     label: 'Face',           desc: 'Max Charisma, Intuition, Logic.',      priority: ['cha', 'int', 'wis', 'dex', 'con', 'str'] },
  { id: 'balanced', label: 'Balanced',       desc: 'Distribute points roughly evenly.',   priority: ['str', 'dex', 'con', 'int', 'wis', 'cha'] },
];

/**
 * Distribute `pool` attribute points across 6 attrs weighted by priority order.
 * Returns values in range [1, 9].
 */
function weightedSRAttrs(pool: number, profile: SRProfile): Record<AttrKey, number> {
  const result = emptyAttrs(1);
  let remaining = pool - 6; // already 1 in each
  if (profile.id === 'balanced') {
    // even distribution with slight jitter
    const base = Math.floor(remaining / 6);
    let extra  = remaining % 6;
    const order = [...ATTR_KEYS].sort(() => Math.random() - 0.5);
    order.forEach(k => {
      const bonus = extra-- > 0 ? 1 : 0;
      result[k] = Math.min(9, 1 + base + bonus);
    });
    return result;
  }
  // Weighted: give top 3 priority stats ~60% of remaining pool
  const top    = profile.priority.slice(0, 3);
  const bottom = profile.priority.slice(3);
  const topShare    = Math.floor(remaining * 0.6);
  const bottomShare = remaining - topShare;
  function distribute(keys: AttrKey[], budget: number) {
    let rem = budget;
    for (const k of keys) {
      if (rem <= 0) break;
      // random amount between 1 and min(4, rem)
      const max = Math.min(4, rem);
      const add = Math.floor(Math.random() * max) + 1;
      result[k] = Math.min(9, result[k] + add);
      rem -= add;
    }
    // distribute any leftover evenly
    if (rem > 0) {
      for (const k of keys) {
        if (rem <= 0) break;
        if (result[k] < 9) { result[k]++; rem--; }
      }
    }
  }
  distribute(top, topShare);
  distribute(bottom, bottomShare);
  return result;
}

export default function ChargenSR6e({ onCreated }: ChargenProps) {
  const [priorities, setPriorities] = useState<PriorityMap>({ ...DEFAULT_PRIORITIES });
  const [essence, setEssence] = useState(6);
  const [edge, setEdge] = useState(1);
  const [srProfileId, setSrProfileId] = useState('samurai');
  const [randomizeNote, setRandomizeNote] = useState('');

  const [form, setForm] = useState({
    characterName: '',
    playerName: '',
    race: cfg.species[0] ?? 'Human',
    class: cfg.classes[0] ?? 'Street Samurai',
    background: '',
    alignment: '',
    level: 1,
    abilityScores: emptyAttrs(1),
    armorClass: 0,
    speed: 10,
    hitPointMaximum: 8,
    currentHitPoints: 8,
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
  function setAttr(key: AttrKey, value: number) {
    setForm(f => ({ ...f, abilityScores: { ...f.abilityScores, [key]: value } }));
  }

  function assignPriority(cat: PriorityCategory, pri: Priority) {
    setPriorities(prev => {
      const next = { ...prev };
      const displaced = (Object.entries(prev) as [PriorityCategory, Priority][]).find(([c, p]) => c !== cat && p === pri);
      if (displaced) next[displaced[0]] = prev[cat];
      next[cat] = pri;
      return next;
    });
  }

  function handleRandomizeAttrs() {
    const profile = SR_PROFILES.find(p => p.id === srProfileId) ?? SR_PROFILES[0];
    const pool = PRIORITY_DATA[priorities.attributes].attributes;
    const attrs = weightedSRAttrs(pool, profile);
    setForm(f => ({ ...f, abilityScores: attrs }));
    setRandomizeNote(`${profile.label} profile — ${pool} attr pts distributed`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const extraNotes = `[Essence: ${essence}] [Edge: ${edge}] [Priorities: ${
      (Object.entries(priorities) as [PriorityCategory, Priority][])
        .map(([cat, pri]) => `${CATEGORY_LABELS[cat]}=${pri}`).join(', ')
    }]`;
    const now = new Date().toISOString();
    const candidate = {
      ...form,
      traits: form.traits ? `${form.traits}\n${extraNotes}` : extraNotes,
      id: newId(),
      proficiencyBonus: 0,
      temporaryHitPoints: 0,
      source: 'manual' as const,
      createdAt: now,
    };
    const parsed = characterSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
    saveCharacter(parsed.data);
    addCharacterToActiveCampaign({ id: parsed.data.id, characterName: parsed.data.characterName, class: parsed.data.class, level: parsed.data.level });
    setError(null);
    onCreated(parsed.data);
  }

  const attrPoints   = PRIORITY_DATA[priorities.attributes].attributes;
  const skillPoints  = PRIORITY_DATA[priorities.skills].skills;
  const resourcesStr = PRIORITY_DATA[priorities.resources].resources;
  const magicStr     = PRIORITY_DATA[priorities.magic].magic;
  const activeSRProfile = SR_PROFILES.find(p => p.id === srProfileId) ?? SR_PROFILES[0];

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Identity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label htmlFor="sr-name" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Character Name *</label><input id="sr-name" required className="input" value={form.characterName} onChange={e => set('characterName', e.target.value)} placeholder="e.g. Ghost" /></div>
        <div><label htmlFor="sr-player" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Player Name</label><input id="sr-player" className="input" value={form.playerName} onChange={e => set('playerName', e.target.value)} placeholder="Your name" /></div>
      </div>

      {/* Metatype / Archetype */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label htmlFor="sr-race" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Metatype</label><select id="sr-race" className="input" value={form.race} onChange={e => set('race', e.target.value)}>{cfg.species.map(r => <option key={r}>{r}</option>)}</select></div>
        <div><label htmlFor="sr-class" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Archetype</label><select id="sr-class" className="input" value={form.class} onChange={e => set('class', e.target.value)}>{cfg.classes.map(c => <option key={c}>{c}</option>)}</select></div>
      </div>

      {/* Priority Table */}
      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          Priority Selection
          <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>Each priority (A–E) can only be used once</span>
        </legend>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: 'var(--text-xs)', width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--color-surface-offset)' }}><th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'left', fontWeight: 700 }}>Category</th>{PRIORITIES.map(p => <th key={p} style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'center', fontWeight: 700 }}>{p}</th>)}</tr></thead>
            <tbody>
              {CATEGORIES.map((cat, i) => (
                <tr key={cat} style={{ background: i % 2 === 0 ? 'var(--color-surface)' : 'var(--color-surface-2)' }}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 600 }}>{CATEGORY_LABELS[cat]}</td>
                  {PRIORITIES.map(pri => (
                    <td key={pri} style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'center' }}>
                      <button type="button" onClick={() => assignPriority(cat, pri)}
                        style={{ width: 28, height: 28, borderRadius: 'var(--radius-full)', border: priorities[cat] === pri ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', background: priorities[cat] === pri ? 'var(--color-primary)' : 'transparent', color: priorities[cat] === pri ? 'var(--color-text-inverse)' : 'var(--color-text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: 'var(--text-xs)' }}
                        aria-label={`Set ${CATEGORY_LABELS[cat]} to priority ${pri}`} aria-pressed={priorities[cat] === pri}>
                        {pri}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          <div><strong style={{ color: 'var(--color-text)' }}>Attr pts:</strong> {attrPoints}</div>
          <div><strong style={{ color: 'var(--color-text)' }}>Skill pts:</strong> {skillPoints}</div>
          <div><strong style={{ color: 'var(--color-text)' }}>Resources:</strong> {resourcesStr}</div>
          <div><strong style={{ color: 'var(--color-text)' }}>Magic/Resonance:</strong> {magicStr}</div>
        </div>
      </fieldset>

      {/* Attributes */}
      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          Attributes <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>{attrPoints} points available</span>
        </legend>

        {/* Weighted Randomize bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
          padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface-offset)', border: '1px solid var(--color-border)',
          marginBottom: 'var(--space-3)',
        }}>
          <label htmlFor="sr-profile" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>Archetype Profile</label>
          <select
            id="sr-profile"
            className="input"
            value={srProfileId}
            onChange={e => setSrProfileId(e.target.value)}
            style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', flex: '0 0 auto', minWidth: 140 }}
          >
            {SR_PROFILES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flex: 1, minWidth: 0 }}>
            {activeSRProfile.desc}
          </span>
          <button type="button" className="btn btn-gold" onClick={handleRandomizeAttrs} style={{ whiteSpace: 'nowrap' }}
            title={`Distribute ${attrPoints} attribute points using ${activeSRProfile.label} weighting`}>
            🎲 Randomize Attrs
          </button>
        </div>
        {randomizeNote && <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{randomizeNote}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          {ATTR_KEYS.map(k => (
            <div key={k}>
              <label htmlFor={`sr-${k}`} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 'var(--space-1)' }}>{ATTR_LABELS[k]}</label>
              <input id={`sr-${k}`} type="number" min={1} max={12} className="input" value={form.abilityScores[k]} onChange={e => setAttr(k, Number(e.target.value))} />
            </div>
          ))}
        </div>
      </fieldset>

      {/* Derived / special stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
        <div><label htmlFor="sr-ac" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Defense Rating</label><input id="sr-ac" type="number" min={0} max={30} className="input" value={form.armorClass} onChange={e => set('armorClass', Number(e.target.value))} /></div>
        <div><label htmlFor="sr-hp" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Physical Monitor</label><input id="sr-hp" type="number" min={1} max={99} className="input" value={form.hitPointMaximum} onChange={e => { set('hitPointMaximum', Number(e.target.value)); set('currentHitPoints', Number(e.target.value)); }} /></div>
        <div><label htmlFor="sr-essence" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Essence</label><input id="sr-essence" type="number" min={0} max={6} step={0.1} className="input" value={essence} onChange={e => setEssence(Number(e.target.value))} /></div>
        <div><label htmlFor="sr-edge" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Edge</label><input id="sr-edge" type="number" min={1} max={7} className="input" value={edge} onChange={e => setEdge(Number(e.target.value))} /></div>
      </div>

      <div><label htmlFor="sr-bg" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Street Background</label><input id="sr-bg" className="input" value={form.background} onChange={e => set('background', e.target.value)} placeholder="Where did you come from? Who do you run with?" /></div>
      <div><label htmlFor="sr-traits" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Qualities / Notes</label><textarea id="sr-traits" className="input" rows={3} maxLength={2000} value={form.traits} onChange={e => set('traits', e.target.value)} style={{ resize: 'vertical' }} placeholder="Positive/negative qualities, contacts, cyberware, notes..." /></div>

      {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>Create Character</button>
    </form>
  );
}
