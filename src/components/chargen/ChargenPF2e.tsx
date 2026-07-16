import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { characterSchema } from '../../lib/schemas';
import type { Character } from '../../lib/schemas';
import { newId, saveCharacter } from '../../lib/storage';
import { addCharacterToActiveCampaign } from '../../lib/storageHelpers';
import { getRulesetChargenConfig } from '../../lib/rulesets/chargen';
import type { ChargenProps } from './types';

const cfg = getRulesetChargenConfig('pathfinder2e');

// PF2e uses a boost system: each boost +2 (or +1 if already ≥18)
const BASE = 10;
const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
type StatKey = typeof STAT_KEYS[number];

// Each ancestry gives 2 fixed boosts + 1 free; background gives 2 fixed + 1 free; class gives 1 fixed
// For simplicity we give players 4 free boosts at creation + background + class key boost selection
const ANCESTRY_BOOSTS: Record<string, [StatKey, StatKey]> = {
  Human: ['str', 'dex'], Elf: ['dex', 'int'], Dwarf: ['con', 'wis'], Gnome: ['con', 'cha'],
  Goblin: ['dex', 'cha'], Halfling: ['dex', 'wis'], Leshy: ['con', 'wis'], Orc: ['str', 'con'],
  Catfolk: ['dex', 'cha'], Fetchling: ['dex', 'cha'], Fleshwarp: ['con', 'int'],
  Kitsune: ['dex', 'cha'], Ratfolk: ['dex', 'int'], Tengu: ['dex', 'int'],
};
const CLASS_KEY_STAT: Record<string, StatKey> = {
  Alchemist: 'int', Barbarian: 'str', Bard: 'cha', Champion: 'str', Cleric: 'wis', Druid: 'wis',
  Fighter: 'str', Gunslinger: 'dex', Inventor: 'int', Investigator: 'int', Magus: 'str',
  Monk: 'str', Oracle: 'cha', Psychic: 'int', Ranger: 'str', Rogue: 'dex', Sorcerer: 'cha',
  Summoner: 'cha', Swashbuckler: 'dex', Thaumaturge: 'cha', Witch: 'int', Wizard: 'int',
};

function applyBoost(val: number): number { return val >= 18 ? val + 1 : val + 2; }
function calcScore(ancestry: string, cls: string, freeBoosts: Set<StatKey>): Record<StatKey, number> {
  const scores = Object.fromEntries(STAT_KEYS.map(k => [k, BASE])) as Record<StatKey, number>;
  const ancestryPair = ANCESTRY_BOOSTS[ancestry] ?? ['str', 'dex'];
  ancestryPair.forEach(k => { scores[k] = applyBoost(scores[k]); });
  const classKey = CLASS_KEY_STAT[cls] ?? 'str';
  scores[classKey] = applyBoost(scores[classKey]);
  freeBoosts.forEach(k => { scores[k] = applyBoost(scores[k]); });
  return scores;
}

export default function ChargenPF2e({ onCreated }: ChargenProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // 4 free boosts at level 1
  const [freeBoosts, setFreeBoosts] = useState<Set<StatKey>>(new Set());

  const [form, setForm] = useState({
    characterName: '',
    playerName: '',
    race: 'Human',
    class: 'Fighter',
    background: 'Acolyte',
    alignment: 'True Neutral',
    level: 1,
    armorClass: 14,
    speed: 25,
    hitPointMaximum: 10,
    currentHitPoints: 10,
    equipment: '',
    traits: '',
    ideals: '',
    bonds: '',
    flaws: '',
  });

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function toggleBoost(k: StatKey) {
    setFreeBoosts(prev => {
      const next = new Set(prev);
      if (next.has(k)) { next.delete(k); } else if (next.size < 4) { next.add(k); }
      return next;
    });
  }

  const scores = calcScore(form.race, form.class, freeBoosts);
  const boostsLeft = 4 - freeBoosts.size;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (boostsLeft > 0) { setError(`Assign all 4 free ability boosts (${boostsLeft} remaining).`); return; }
    const now = new Date().toISOString();
    const hp = scores.con >= 18 ? (10 + 4) * form.level : (10 + Math.floor((scores.con - 10) / 2)) * form.level;
    const candidate = {
      ...form,
      abilityScores: scores as unknown as Record<string, number>,
      hitPointMaximum: hp,
      currentHitPoints: hp,
      id: newId(),
      proficiencyBonus: Math.ceil(form.level / 4) + 1,
      temporaryHitPoints: 0,
      source: 'manual' as const,
      createdAt: now,
    };
    const parsed = characterSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
    saveCharacter(parsed.data);
    addCharacterToActiveCampaign({ id: parsed.data.id, characterName: parsed.data.characterName, class: parsed.data.class, level: parsed.data.level });
    onCreated(parsed.data);
  }

  const s = { label: { fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' } as React.CSSProperties };
  const ancestryBoosts = ANCESTRY_BOOSTS[form.race] ?? ['str', 'dex'];
  const classBoost = CLASS_KEY_STAT[form.class] ?? 'str';

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Names */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="pf-charName">Character Name *</label><input id="pf-charName" required className="input" value={form.characterName} onChange={e => set('characterName', e.target.value)} placeholder="e.g. Serevyn Ashvale" /></div>
        <div><label style={s.label} htmlFor="pf-playerName">Player Name</label><input id="pf-playerName" className="input" value={form.playerName} onChange={e => set('playerName', e.target.value)} /></div>
      </div>

      {/* Ancestry / Class / Background */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="pf-ancestry">Ancestry</label><select id="pf-ancestry" className="input" value={form.race} onChange={e => set('race', e.target.value)}>{cfg.species.map(r => <option key={r}>{r}</option>)}</select></div>
        <div><label style={s.label} htmlFor="pf-class">Class</label><select id="pf-class" className="input" value={form.class} onChange={e => set('class', e.target.value)}>{cfg.classes.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label style={s.label} htmlFor="pf-bg">Background</label><select id="pf-bg" className="input" value={form.background} onChange={e => set('background', e.target.value)}>{cfg.backgrounds.map(b => <option key={b}>{b}</option>)}</select></div>
      </div>

      {/* Level / AC / Speed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="pf-level">Level</label><input id="pf-level" type="number" min={1} max={20} className="input" value={form.level} onChange={e => set('level', Number(e.target.value))} /></div>
        <div><label style={s.label} htmlFor="pf-ac">Armor Class</label><input id="pf-ac" type="number" min={0} max={30} className="input" value={form.armorClass} onChange={e => set('armorClass', Number(e.target.value))} /></div>
        <div><label style={s.label} htmlFor="pf-speed">Speed (ft)</label><input id="pf-speed" type="number" min={0} max={100} className="input" value={form.speed} onChange={e => set('speed', Number(e.target.value))} /></div>
      </div>

      {/* Ability Boosts panel */}
      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>Ability Scores — Boost System</legend>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', margin: '0 0 var(--space-3)' }}>
          Each boost adds +2 (or +1 if already ≥18). Your ancestry, class, and 4 free boosts are applied below.
        </p>

        {/* Boost source legend */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} /> Ancestry ({form.race})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-gold)', display: 'inline-block' }} /> Class ({form.class})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-blue)', display: 'inline-block' }} /> Free ({boostsLeft} left)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          {STAT_KEYS.map((k, i) => {
            const label = cfg.stats[i]?.label ?? k.toUpperCase();
            const hint = cfg.stats[i]?.hint ?? '';
            const isAncestry = ancestryBoosts.includes(k as StatKey);
            const isClass = classBoost === k;
            const isFree = freeBoosts.has(k);
            return (
              <div key={k} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'var(--color-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{hint.split(' ').slice(0, 5).join(' ')}…</div>
                  </div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>{scores[k]}</div>
                </div>
                {/* Boost dots */}
                <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                  {isAncestry && <span title="Ancestry boost" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />}
                  {isClass && <span title="Class key ability boost" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-gold)', display: 'inline-block' }} />}
                  <button
                    type="button"
                    onClick={() => toggleBoost(k)}
                    style={{
                      width: 8, height: 8, borderRadius: '50%', border: '1.5px solid',
                      borderColor: isFree ? 'var(--color-blue)' : 'var(--color-border)',
                      background: isFree ? 'var(--color-blue)' : 'transparent',
                      cursor: boostsLeft === 0 && !isFree ? 'not-allowed' : 'pointer',
                      padding: 0,
                    }}
                    aria-label={isFree ? `Remove free boost from ${label}` : `Apply free boost to ${label}`}
                    disabled={boostsLeft === 0 && !isFree}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {boostsLeft > 0 && <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>Assign {boostsLeft} more free boost{boostsLeft > 1 ? 's' : ''} by clicking the blue dot on a stat.</div>}
      </fieldset>

      {/* Alignment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="pf-align">Alignment</label><select id="pf-align" className="input" value={form.alignment} onChange={e => set('alignment', e.target.value)}>{cfg.alignments.map(a => <option key={a}>{a}</option>)}</select></div>
      </div>

      <div><label style={s.label} htmlFor="pf-traits">Character Notes</label><textarea id="pf-traits" className="input" rows={2} maxLength={2000} value={form.traits} onChange={e => set('traits', e.target.value)} style={{ resize: 'vertical' }} /></div>

      {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>Create Character</button>
    </form>
  );
}
