import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { characterSchema } from '../../lib/schemas';
import type { Character } from '../../lib/schemas';
import { newId, saveCharacter } from '../../lib/storage';
import { addCharacterToActiveCampaign } from '../../lib/storageHelpers';
import { abilityModifier, formatModifier } from '../../lib/dice';
import {
  ABILITY_KEYS,
  emptyScores,
  getDefaultAC,
  getDefaultHP,
  getExpectedStatBudget,
  getPointBuySpent,
  getStandardArrayScores,
  getStatBudgetWarning,
  randomizeStatBlock,
  rollStatBlock,
  type AbilityKey,
} from '../../lib/chargen';
import { getClassFeaturesUpToLevel, getBackgroundFeature } from '../../lib/classTraits';
import { getRulesetChargenConfig } from '../../lib/rulesets/chargen';
import type { ChargenProps } from './types';

const cfg = getRulesetChargenConfig('dnd5e');
const STAT_METHODS = ['standard_array', 'point_buy', 'dice_rolls'] as const;
type StatMethod = typeof STAT_METHODS[number];

export default function ChargenDnD5e({ onCreated }: ChargenProps) {
  const navigate = useNavigate();
  const [statMethod, setStatMethod] = useState<StatMethod>('standard_array');
  const [rolledValues, setRolledValues] = useState<number[]>([]);
  const [rollDetails, setRollDetails] = useState('');
  const [randomizeNote, setRandomizeNote] = useState('');
  const [traitsOpen, setTraitsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(() => ({
    characterName: '',
    playerName: '',
    race: 'Human',
    class: 'Fighter',
    background: 'Soldier',
    alignment: 'True Neutral',
    level: 1,
    abilityScores: getStandardArrayScores('Fighter'),
    armorClass: 10,
    speed: 30,
    hitPointMaximum: 10,
    currentHitPoints: 10,
    equipment: '',
    traits: '',
    ideals: '',
    bonds: '',
    flaws: '',
  }));

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }
  function setAbility(key: AbilityKey, value: number) {
    setForm(f => ({ ...f, abilityScores: { ...f.abilityScores, [key]: value } }));
  }

  function applyStandardArray(className = form.class) {
    setForm(f => ({ ...f, abilityScores: getStandardArrayScores(className) }));
    setStatMethod('standard_array');
    setRolledValues([]);
    setRollDetails('');
    setRandomizeNote('');
  }

  function randomizeStats() {
    const result = randomizeStatBlock(form.class, form.level);
    setForm(f => ({
      ...f,
      abilityScores: result.scores,
      armorClass: result.ac,
      hitPointMaximum: result.hp,
      currentHitPoints: result.hp,
    }));
    setRandomizeNote(result.detail);
    setStatMethod('dice_rolls');
    setRolledValues(Object.values(result.scores).sort((a, b) => b - a));
    setRollDetails(result.detail);
  }

  function rollStats() {
    const rolled = rollStatBlock();
    setRolledValues(rolled.scores);
    setRollDetails(rolled.rolls.map(r => `[${r.dice.join(', ')}] → ${r.total}`).join(' | '));
    setStatMethod('dice_rolls');
    setRandomizeNote('');
  }

  function assignRolledStats() {
    if (rolledValues.length !== 6) return;
    const sorted = [...rolledValues].sort((a, b) => b - a);
    const assigned = emptyScores(8);
    const priorityTemplate = getStandardArrayScores(form.class);
    const sortedAbilities = Object.entries(priorityTemplate)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key as AbilityKey);
    sortedAbilities.forEach((ability, idx) => { assigned[ability] = sorted[idx] ?? 8; });
    const ac = getDefaultAC(form.class, assigned);
    const hp = getDefaultHP(form.class, form.level, assigned.con);
    setForm(f => ({ ...f, abilityScores: assigned, armorClass: ac, hitPointMaximum: hp, currentHitPoints: hp }));
  }

  function handleMethodChange(method: StatMethod) {
    setStatMethod(method);
    setError(null);
    setRandomizeNote('');
    if (method === 'standard_array') applyStandardArray();
    if (method === 'point_buy') setForm(f => ({ ...f, abilityScores: emptyScores(8) }));
    if (method === 'dice_rolls') { setRolledValues([]); setRollDetails(''); }
  }

  function handleClassChange(nextClass: string) {
    if (statMethod === 'standard_array') {
      setForm(f => ({ ...f, class: nextClass, abilityScores: getStandardArrayScores(nextClass) }));
    } else {
      set('class', nextClass);
    }
  }

  const pointBuySpent = useMemo(() => getPointBuySpent(form.abilityScores), [form.abilityScores]);
  const pointBuyRemaining = 27 - pointBuySpent;
  const statBudgetWarning = useMemo(() => getStatBudgetWarning(form.abilityScores, form.level), [form.abilityScores, form.level]);
  const expectedBudget = useMemo(() => getExpectedStatBudget(form.level), [form.level]);
  const classFeatures = useMemo(() => getClassFeaturesUpToLevel(form.class, Math.min(form.level, 3)), [form.class, form.level]);
  const backgroundFeature = useMemo(() => getBackgroundFeature(form.background), [form.background]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (statMethod === 'point_buy' && pointBuySpent > 27) {
      setError(`Point buy over budget by ${pointBuySpent - 27}.`);
      return;
    }
    const profBonus = Math.ceil(form.level / 4) + 1;
    const now = new Date().toISOString();
    const candidate = { ...form, id: newId(), proficiencyBonus: profBonus, temporaryHitPoints: 0, source: 'manual' as const, createdAt: now };
    const parsed = characterSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
    saveCharacter(parsed.data);
    addCharacterToActiveCampaign({ id: parsed.data.id, characterName: parsed.data.characterName, class: parsed.data.class, level: parsed.data.level });
    onCreated(parsed.data);
  }

  const s = { label: { fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' } as React.CSSProperties };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Name row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="d5-charName">Character Name *</label><input id="d5-charName" required className="input" value={form.characterName} onChange={e => set('characterName', e.target.value)} placeholder="e.g. Aric Stormborn" /></div>
        <div><label style={s.label} htmlFor="d5-playerName">Player Name</label><input id="d5-playerName" className="input" value={form.playerName} onChange={e => set('playerName', e.target.value)} placeholder="Your name" /></div>
      </div>

      {/* Race / Class */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="d5-race">Race</label><select id="d5-race" className="input" value={form.race} onChange={e => set('race', e.target.value)}>{cfg.species.map(r => <option key={r}>{r}</option>)}</select></div>
        <div><label style={s.label} htmlFor="d5-class">Class</label><select id="d5-class" className="input" value={form.class} onChange={e => handleClassChange(e.target.value)}>{cfg.classes.map(c => <option key={c}>{c}</option>)}</select></div>
      </div>

      {/* Level / AC / HP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="d5-level">Level</label><input id="d5-level" type="number" min={1} max={20} className="input" value={form.level} onChange={e => set('level', Number(e.target.value))} /></div>
        <div><label style={s.label} htmlFor="d5-ac">Armor Class</label><input id="d5-ac" type="number" min={0} max={30} className="input" value={form.armorClass} onChange={e => set('armorClass', Number(e.target.value))} /></div>
        <div><label style={s.label} htmlFor="d5-hp">Max HP</label><input id="d5-hp" type="number" min={1} max={999} className="input" value={form.hitPointMaximum} onChange={e => { set('hitPointMaximum', Number(e.target.value)); set('currentHitPoints', Number(e.target.value)); }} /></div>
      </div>

      {/* Stat method tabs */}
      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Ability Scores</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {(['standard_array', 'point_buy', 'dice_rolls'] as StatMethod[]).map(m => (
            <button key={m} type="button" className={`btn ${statMethod === m ? 'btn-primary' : 'btn-ghost'}`} onClick={() => handleMethodChange(m)}>
              {m === 'standard_array' ? 'Standard Array' : m === 'point_buy' ? 'Point Buy' : 'Dice Rolls'}
            </button>
          ))}
          <button type="button" className="btn btn-gold" onClick={randomizeStats} title="4d6 drop lowest, assigned by class priority">🎲 Randomize</button>
        </div>

        {randomizeNote && <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{randomizeNote}</div>}

        {statMethod === 'point_buy' && (
          <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-offset)', fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}><span>Points spent</span><strong>{pointBuySpent}/27</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: pointBuyRemaining < 0 ? 'var(--color-error)' : 'var(--color-text-muted)' }}><span>Remaining</span><span>{pointBuyRemaining}</span></div>
          </div>
        )}

        {statMethod === 'dice_rolls' && (
          <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-offset)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={rollStats}>Roll 4d6 Drop Lowest</button>
              <button type="button" className="btn btn-ghost" onClick={assignRolledStats} disabled={rolledValues.length !== 6}>Assign to {form.class}</button>
            </div>
            {rolledValues.length > 0 && (
              <>
                <div style={{ fontSize: 'var(--text-sm)' }}>Rolled: <strong>{rolledValues.join(', ')}</strong></div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', wordBreak: 'break-all' }}>{rollDetails}</div>
              </>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          {ABILITY_KEYS.map((k, i) => {
            const value = form.abilityScores[k];
            const min = statMethod === 'point_buy' ? 8 : 1;
            const max = statMethod === 'point_buy' ? 15 : 30;
            const stat = cfg.stats[i];
            return (
              <div key={k}>
                <label htmlFor={`d5-${k}`} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-1)' }}>
                  {stat?.label ?? k.toUpperCase()}
                  {stat?.hint && <span title={stat.hint} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', cursor: 'help', background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)', fontSize: 10, fontWeight: 700 }}>i</span>}
                </label>
                <input id={`d5-${k}`} type="number" min={min} max={max} className="input" value={value} onChange={e => setAbility(k, Number(e.target.value))} />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-1)' }}>{formatModifier(abilityModifier(value))}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Expected total for level {form.level}: ~{expectedBudget} points.</div>
        {statBudgetWarning && <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>{statBudgetWarning}</div>}
      </fieldset>

      {/* Class & Background Traits */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <button type="button" onClick={() => setTraitsOpen(o => !o)} aria-expanded={traitsOpen}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-offset)', fontSize: 'var(--text-sm)', fontWeight: 600, borderBottom: traitsOpen ? '1px solid var(--color-border)' : 'none', cursor: 'pointer' }}>
          <span>Class &amp; Background Traits</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', transform: traitsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}>▼</span>
        </button>
        {traitsOpen && (
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {classFeatures.length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)', marginBottom: 'var(--space-3)' }}>{form.class} — Level 1{form.level >= 2 ? '–' + Math.min(form.level, 3) : ''} Features</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {classFeatures.map(f => (
                    <div key={`${f.level}-${f.name}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'var(--color-primary-highlight)', color: 'var(--color-primary)', fontWeight: 600 }}>Lv {f.level}</span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{f.name}</span>
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0, maxWidth: '100%' }}>{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {backgroundFeature && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>{form.background} — Background Feature</div>
                <div style={{ marginBottom: 'var(--space-1)' }}><span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{backgroundFeature.name}</span></div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0, maxWidth: '100%' }}>{backgroundFeature.description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Background / Alignment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="d5-bg">Background</label><select id="d5-bg" className="input" value={form.background} onChange={e => set('background', e.target.value)}>{cfg.backgrounds.map(b => <option key={b}>{b}</option>)}</select></div>
        <div><label style={s.label} htmlFor="d5-align">Alignment</label><select id="d5-align" className="input" value={form.alignment} onChange={e => set('alignment', e.target.value)}>{cfg.alignments.map(a => <option key={a}>{a}</option>)}</select></div>
      </div>

      <div><label style={s.label} htmlFor="d5-traits">Personality Traits</label><textarea id="d5-traits" className="input" rows={2} maxLength={2000} value={form.traits} onChange={e => set('traits', e.target.value)} style={{ resize: 'vertical' }} /></div>

      {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>Create Character</button>
    </form>
  );
}
