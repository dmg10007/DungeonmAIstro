import { useMemo, useState } from 'react';
import { characterSchema } from '../../lib/schemas';
import { newId, saveCharacter } from '../../lib/storage';
import { addCharacterToActiveCampaign } from '../../lib/storageHelpers';
import { getRulesetChargenConfig } from '../../lib/rulesets/chargen';
import type { ChargenProps } from './types';

const cfg = getRulesetChargenConfig('callofcthulhu7e');

type CocKey = 'str' | 'con' | 'siz' | 'dex' | 'app' | 'int' | 'pow' | 'edu';
const COC_STATS: { key: CocKey; label: string; fullName: string; hint: string; defaultVal: number }[] = [
  { key: 'str', label: 'STR', fullName: 'Strength',     hint: 'Physical power.',          defaultVal: 50 },
  { key: 'con', label: 'CON', fullName: 'Constitution', hint: 'Toughness / HP.',           defaultVal: 50 },
  { key: 'siz', label: 'SIZ', fullName: 'Size',         hint: 'Body mass ~140 lb at 50.',  defaultVal: 50 },
  { key: 'dex', label: 'DEX', fullName: 'Dexterity',    hint: 'Agility, Dodge = DEX÷2.',   defaultVal: 50 },
  { key: 'app', label: 'APP', fullName: 'Appearance',   hint: 'First impressions.',        defaultVal: 50 },
  { key: 'int', label: 'INT', fullName: 'Intelligence', hint: 'Skill Pts = INT×2.',        defaultVal: 50 },
  { key: 'pow', label: 'POW', fullName: 'Power',        hint: 'Willpower, Sanity = POW.',  defaultVal: 50 },
  { key: 'edu', label: 'EDU', fullName: 'Education',    hint: 'Own Language start %.',     defaultVal: 60 },
];

const STAT_HINTS: Record<CocKey, string> = {
  str: 'Average human strength.',
  con: 'Average healthy human.',
  siz: 'A touch under average size · ~140 lb',
  dex: 'Average human dexterity.',
  app: 'Average human appearance.',
  int: 'Average human intellect.',
  pow: 'Average human.',
  edu: 'High school graduate.',
};

const POINT_BUY_POOL = 460;
const STAT_MAX = 90;
const STAT_MIN = 15;

function calcHP(con: number, siz: number)  { return Math.floor((con + siz) / 10); }
function calcMP(pow: number)               { return Math.floor(pow / 5); }
function calcDamageBonus(str: number, siz: number): string {
  const sum = str + siz;
  if (sum <= 64)  return '-2';
  if (sum <= 84)  return '-1';
  if (sum <= 124) return '0';
  if (sum <= 164) return '+1d4';
  if (sum <= 204) return '+1d6';
  return '+2d6';
}
function calcBuild(str: number, siz: number): number {
  const sum = str + siz;
  if (sum <= 64)  return -2;
  if (sum <= 84)  return -1;
  if (sum <= 124) return 0;
  if (sum <= 164) return 1;
  if (sum <= 204) return 2;
  return 3;
}
function calcMoveRate(str: number, dex: number, siz: number): number {
  if (str < siz && dex < siz) return 7;
  if (str >= siz || dex >= siz) return 8;
  return 9;
}

type GenMethod = 'point_buy' | 'quick_build' | 'manual_roll' | 'weighted_roll';

const QUICK_BUILD_DEFAULTS: Record<CocKey, number> = {
  str: 50, con: 50, siz: 55, dex: 55, app: 50, int: 65, pow: 50, edu: 65,
};

function rollCoC(is2d6plus6: boolean): number {
  const roll = is2d6plus6
    ? Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1 + 6
    : Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  return Math.min(STAT_MAX, roll * 5);
}

function rollAllStats(): Record<CocKey, number> {
  return {
    str: rollCoC(false), con: rollCoC(false), siz: rollCoC(true),
    dex: rollCoC(false), app: rollCoC(false), int: rollCoC(true),
    pow: rollCoC(false), edu: rollCoC(true),
  };
}

interface CoCProfile { id: string; label: string; desc: string; priority: CocKey[] }
const COC_PROFILES: CoCProfile[] = [
  {
    id: 'investigator',
    label: 'Investigator',
    desc: 'Prioritise INT, EDU, POW — the classic academic.',
    priority: ['int', 'edu', 'pow', 'dex', 'con', 'str', 'siz', 'app'],
  },
  {
    id: 'bruiser',
    label: 'Bruiser',
    desc: 'Prioritise STR, CON, SIZ — built for physical action.',
    priority: ['str', 'con', 'siz', 'dex', 'pow', 'int', 'app', 'edu'],
  },
  {
    id: 'sneaky',
    label: 'Sneaky',
    desc: 'Prioritise DEX, APP, INT — social and nimble.',
    priority: ['dex', 'app', 'int', 'pow', 'con', 'str', 'siz', 'edu'],
  },
];

function weightedCoCRoll(profile: CoCProfile): Record<CocKey, number> {
  const is2d6plus6: Record<CocKey, boolean> = {
    str: false, con: false, siz: true,
    dex: false, app: false, int: true,
    pow: false, edu: true,
  };
  const rawValues = (Object.keys(is2d6plus6) as CocKey[]).map(k => ({
    key: k,
    val: rollCoC(is2d6plus6[k]),
  }));
  const sorted = [...rawValues].sort((a, b) => b.val - a.val);
  const result = {} as Record<CocKey, number>;
  profile.priority.forEach((k, i) => {
    result[k] = sorted[i]?.val ?? 50;
  });
  return result;
}

// Tab definitions — label kept short so all four fit on one line at ~640px+
const TABS: { id: GenMethod; icon: string; label: string }[] = [
  { id: 'point_buy',     icon: '⚖',  label: 'Point Buy'     },
  { id: 'quick_build',   icon: '⚡', label: 'Quick Build'   },
  { id: 'manual_roll',   icon: '🎲', label: 'Manual Roll'   },
  { id: 'weighted_roll', icon: '⚖️', label: 'Weighted Roll' },
];

export default function ChargenCoC7e({ onCreated }: ChargenProps) {
  const [genMethod, setGenMethod] = useState<GenMethod>('point_buy');
  const [error, setError] = useState<string | null>(null);
  const [rollNote, setRollNote] = useState('');
  const [weightProfileId, setWeightProfileId] = useState('investigator');

  const [stats, setStats] = useState<Record<CocKey, number>>(() => ({
    str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 50, edu: 60,
  }));

  const [form, setForm] = useState({
    characterName: '',
    playerName: '',
    occupation: cfg.species[0],
    era: cfg.classes[0],
    personalDescription: '',
    traits: '',
  });

  function setF<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }
  function setStat(key: CocKey, val: number) {
    setStats(s => ({ ...s, [key]: Math.max(STAT_MIN, Math.min(STAT_MAX, val)) }));
  }

  const pointsUsed = useMemo(() => Object.values(stats).reduce((a, b) => a + b, 0), [stats]);
  const pointsLeft = POINT_BUY_POOL - pointsUsed;

  const hp       = useMemo(() => calcHP(stats.con, stats.siz), [stats.con, stats.siz]);
  const mp       = useMemo(() => calcMP(stats.pow), [stats.pow]);
  const sanity   = useMemo(() => stats.pow, [stats.pow]);
  const dmgBonus = useMemo(() => calcDamageBonus(stats.str, stats.siz), [stats.str, stats.siz]);
  const build    = useMemo(() => calcBuild(stats.str, stats.siz), [stats.str, stats.siz]);
  const moveRate = useMemo(() => calcMoveRate(stats.str, stats.dex, stats.siz), [stats.str, stats.dex, stats.siz]);
  const dodge    = useMemo(() => Math.floor(stats.dex / 2), [stats.dex]);
  const skillPts = useMemo(() => stats.int * 2, [stats.int]);
  const langOwn  = useMemo(() => stats.edu, [stats.edu]);

  function handleQuickBuild() {
    setStats({ ...QUICK_BUILD_DEFAULTS });
    setGenMethod('quick_build');
    setRollNote('');
  }

  function handleManualRoll() {
    const rolled = rollAllStats();
    setStats(rolled);
    setGenMethod('manual_roll');
    setRollNote('STR/CON/DEX/APP/POW: 3d6×5 | SIZ/INT/EDU: (2d6+6)×5 — capped at 90');
  }

  function handleWeightedRoll() {
    const profile = COC_PROFILES.find(p => p.id === weightProfileId) ?? COC_PROFILES[0];
    const rolled = weightedCoCRoll(profile);
    setStats(rolled);
    setGenMethod('weighted_roll');
    setRollNote(`Weighted [${profile.label}]: best rolls assigned to ${profile.priority.slice(0, 3).map(k => k.toUpperCase()).join(', ')}…`);
  }

  function handleResetPoints() {
    setStats({ str: 50, con: 50, siz: 50, dex: 50, app: 50, int: 50, pow: 50, edu: 60 });
    setGenMethod('point_buy');
    setRollNote('');
  }

  function handleSlider(key: CocKey, newVal: number) {
    if (genMethod !== 'point_buy') { setStat(key, newVal); return; }
    const diff = newVal - stats[key];
    if (diff > 0 && pointsLeft - diff < 0) return;
    setStat(key, newVal);
  }

  function handleTabClick(m: GenMethod) {
    if (m === 'point_buy')     handleResetPoints();
    else if (m === 'quick_build')   handleQuickBuild();
    else if (m === 'manual_roll')   handleManualRoll();
    else { setGenMethod('weighted_roll'); setRollNote(''); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (genMethod === 'point_buy' && Math.abs(pointsLeft) > 5) {
      setError(`Distribute all points. ${pointsLeft > 0 ? `${pointsLeft} unspent.` : `${Math.abs(pointsLeft)} over budget.`}`);
      return;
    }
    const notes = [
      `Era: ${form.era}`,
      `Occupation: ${form.occupation}`,
      form.personalDescription && `Description: ${form.personalDescription}`,
      `[HP:${hp}][MP:${mp}][SAN:${sanity}][DMG:${dmgBonus}][Build:${build}][MOV:${moveRate}][Dodge:${dodge}%][Skills:${skillPts}][Lang:${langOwn}%]`,
    ].filter(Boolean).join(' | ');

    const candidate = {
      characterName: form.characterName,
      playerName: form.playerName,
      race: form.occupation,
      class: form.era,
      background: form.personalDescription,
      alignment: '',
      level: 1,
      abilityScores: { str: stats.str, dex: stats.dex, con: stats.con, int: stats.int, wis: stats.pow, cha: stats.app },
      armorClass: 10,
      speed: moveRate * 5,
      hitPointMaximum: hp,
      currentHitPoints: hp,
      equipment: '',
      traits: (form.traits ? form.traits + ' ' : '') + notes,
      ideals: '', bonds: '', flaws: '',
      id: newId(),
      proficiencyBonus: 0,
      temporaryHitPoints: 0,
      source: 'manual' as const,
      createdAt: new Date().toISOString(),
    };
    const parsed = characterSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.errors[0].message); return; }
    saveCharacter(parsed.data);
    addCharacterToActiveCampaign({ id: parsed.data.id, characterName: parsed.data.characterName, class: parsed.data.class, level: parsed.data.level });
    onCreated(parsed.data);
  }

  const s = { label: { fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' } as React.CSSProperties };
  const LEFT_STATS:  CocKey[] = ['str', 'siz', 'app', 'pow'];
  const RIGHT_STATS: CocKey[] = ['con', 'dex', 'int', 'edu'];
  const activeWeightProfile = COC_PROFILES.find(p => p.id === weightProfileId) ?? COC_PROFILES[0];

  function StatSlider({ k }: { k: CocKey }) {
    const statDef = COC_STATS.find(s => s.key === k)!;
    const val = stats[k];
    return (
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, minWidth: 36 }}>{statDef.label}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{statDef.fullName}</span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{STAT_HINTS[k]}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <input
            type="range" min={STAT_MIN} max={STAT_MAX} step={5} value={val}
            onChange={e => handleSlider(k, Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--color-primary)', height: 4 }}
            aria-label={`${statDef.fullName} value`}
          />
          <input
            type="number" min={STAT_MIN} max={STAT_MAX} value={val}
            onChange={e => handleSlider(k, Number(e.target.value))}
            style={{ width: 52, textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 600, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '2px 4px', background: 'var(--color-surface-2)', color: 'var(--color-text)' }}
          />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Names */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="coc-charName">Investigator Name *</label><input id="coc-charName" required className="input" value={form.characterName} onChange={e => setF('characterName', e.target.value)} placeholder="e.g. Eleanor Voss" /></div>
        <div><label style={s.label} htmlFor="coc-playerName">Player Name</label><input id="coc-playerName" className="input" value={form.playerName} onChange={e => setF('playerName', e.target.value)} /></div>
      </div>

      {/* Occupation / Era */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div><label style={s.label} htmlFor="coc-occ">Occupation</label><select id="coc-occ" className="input" value={form.occupation} onChange={e => setF('occupation', e.target.value)}>{cfg.species.map(o => <option key={o}>{o}</option>)}</select></div>
        <div><label style={s.label} htmlFor="coc-era">Era</label><select id="coc-era" className="input" value={form.era} onChange={e => setF('era', e.target.value)}>{cfg.classes.map(c => <option key={c}>{c}</option>)}</select></div>
      </div>

      {/* Characteristics */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--color-surface-offset)', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-3) var(--space-4)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', letterSpacing: '0.05em', margin: 0 }}>Characteristics</h2>
        </div>

        {/* Generation method tabs — flex-wrap so they never overflow horizontally */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--color-border)',
        }}>
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabClick(id)}
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
                border: 'none',
                borderRight: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
                background: genMethod === id ? 'var(--color-primary)' : 'var(--color-surface)',
                color: genMethod === id ? 'var(--color-text-inverse)' : 'var(--color-text-muted)',
                transition: 'background 180ms ease, color 180ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Weighted Roll sub-panel */}
        {genMethod === 'weighted_roll' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)',
          }}>
            <label htmlFor="coc-wp" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, whiteSpace: 'nowrap' }}>Profile</label>
            <select
              id="coc-wp"
              className="input"
              value={weightProfileId}
              onChange={e => setWeightProfileId(e.target.value)}
              style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', flex: '0 0 auto', minWidth: 130 }}
            >
              {COC_PROFILES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flex: 1 }}>
              {activeWeightProfile.desc}
            </span>
            <button
              type="button"
              className="btn btn-gold"
              onClick={handleWeightedRoll}
              style={{ whiteSpace: 'nowrap' }}
            >
              🎲 Roll with Weight
            </button>
          </div>
        )}

        {/* Pool banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--text-xs)',
        }}>
          {genMethod === 'point_buy' ? (
            <>
              <span>Drag to distribute <strong>{POINT_BUY_POOL}</strong> points. Each stat capped at {STAT_MAX}.</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: pointsLeft < 0 ? 'var(--color-error)' : 'var(--color-primary)', whiteSpace: 'nowrap' }}>{pointsLeft} left.</span>
              <button type="button" onClick={handleResetPoints} style={{ fontSize: 'var(--text-xs)', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', cursor: 'pointer' }}>↺ Reset</button>
            </>
          ) : (
            <span style={{ color: 'var(--color-text-muted)' }}>
              {genMethod === 'quick_build' ? 'Quick Build defaults applied — adjust any value.' : rollNote || 'Select a profile above and click Roll with Weight.'}
            </span>
          )}
        </div>

        {/* Stat sliders grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div style={{ padding: 'var(--space-4)', borderRight: '1px solid var(--color-border)' }}>
            {LEFT_STATS.map(k => <StatSlider key={k} k={k} />)}
          </div>
          <div style={{ padding: 'var(--space-4)' }}>
            {RIGHT_STATS.map(k => <StatSlider key={k} k={k} />)}
          </div>
        </div>
      </div>

      {/* Derived Values */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ background: 'var(--color-surface-offset)', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-2) var(--space-4)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, color: 'var(--color-text-muted)' }}>Derived Values</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {[
            { label: 'Hit Points', sub: 'CON+SIZ', value: hp },
            { label: 'Sanity (start)', sub: 'POW', value: sanity },
            { label: 'Magic Points', sub: 'POW', value: mp },
            { label: 'Damage Bonus', sub: 'STR+SIZ', value: dmgBonus },
            { label: 'Build', sub: 'STR+SIZ', value: build },
            { label: 'Move Rate', sub: 'STR+DEX+SIZ', value: moveRate },
            { label: 'Dodge (start %)', sub: 'DEX', value: `${dodge}%` },
            { label: 'Personal Skill Pts', sub: 'INT', value: skillPts },
            { label: 'Language (Own) %', sub: 'EDU', value: `${langOwn}%` },
          ].map((row, i) => (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-2) var(--space-4)',
              borderBottom: i < 8 ? '1px solid var(--color-border)' : 'none',
              borderRight: i % 2 === 0 ? '1px solid var(--color-border)' : 'none',
              background: i % 4 < 2 ? 'var(--color-surface)' : 'var(--color-surface-2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-border)' }}>›</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{row.sub}</span>
              </div>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-primary)' }}>{String(row.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div><label style={s.label} htmlFor="coc-desc">Personal Description</label><textarea id="coc-desc" className="input" rows={2} maxLength={2000} value={form.personalDescription} onChange={e => setF('personalDescription', e.target.value)} style={{ resize: 'vertical' }} placeholder="Appearance, mannerisms, notable features…" /></div>
      <div><label style={s.label} htmlFor="coc-traits">Personality &amp; Background Notes</label><textarea id="coc-traits" className="input" rows={2} maxLength={2000} value={form.traits} onChange={e => setF('traits', e.target.value)} style={{ resize: 'vertical' }} placeholder="Ideology, significant people, treasured possessions, injuries…" /></div>

      {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>Create Investigator</button>
    </form>
  );
}
