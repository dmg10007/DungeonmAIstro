import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { characterSchema } from '../lib/schemas';
import type { Character } from '../lib/schemas';
import { newId } from '../lib/storage';
import { addCharacterToActiveCampaign } from '../lib/storageHelpers';
import { abilityModifier, formatModifier } from '../lib/dice';
import {
  ABILITY_KEYS,
  emptyScores,
  getExpectedStatBudget,
  getPointBuySpent,
  getStandardArrayScores,
  getStatBudgetWarning,
  randomizeStatBlock,
  rollStatBlock,
  type AbilityKey,
  type AbilityScores,
} from '../lib/chargen';

const RACES = ['Human','Elf','Dwarf','Halfling','Dragonborn','Gnome','Half-Elf','Half-Orc','Tiefling'];
const CLASSES = ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
const BACKGROUNDS = ['Acolyte','Charlatan','Criminal','Entertainer','Folk Hero','Guild Artisan','Hermit','Noble','Outlander','Sage','Sailor','Soldier','Urchin'];
const ALIGNMENTS = ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'];
const STAT_METHODS = ['standard_array', 'point_buy', 'dice_rolls'] as const;
type StatMethod = typeof STAT_METHODS[number];

const STAT_INFO: Record<AbilityKey, string> = {
  str: 'Strength covers physical power, lifting, climbing, jumping, melee force, and Athletics checks.',
  dex: 'Dexterity affects initiative, stealth, reflexes, ranged attacks, finesse weapons, and many Armor Class calculations.',
  con: 'Constitution affects hit points, endurance, toughness, and concentration-related checks.',
  int: 'Intelligence supports memory, reasoning, investigation, arcane knowledge, and Wizard spellcasting.',
  wis: 'Wisdom covers perception, insight, instincts, survival, and Cleric or Druid spellcasting.',
  cha: 'Charisma drives persuasion, deception, presence, performance, leadership, and several spellcasting classes.',
};

export default function CharacterLab() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'create' | 'import'>('create');
  const [statMethod, setStatMethod] = useState<StatMethod>('standard_array');
  const [rolledValues, setRolledValues] = useState<number[]>([]);
  const [rollDetails, setRollDetails] = useState<string>('');
  const [randomizeNote, setRandomizeNote] = useState<string>('');
  const [form, setForm] = useState({
    characterName: '', playerName: '', race: RACES[0], class: CLASSES[4],
    background: BACKGROUNDS[0], alignment: ALIGNMENTS[0], level: 1,
    abilityScores: getStandardArrayScores(CLASSES[4]),
    armorClass: 10, speed: 30, hitPointMaximum: 10, currentHitPoints: 10,
    equipment: '', traits: '', ideals: '', bonds: '', flaws: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Character | null>(null);

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
    const result = randomizeStatBlock(form.class);
    setForm(f => ({ ...f, abilityScores: result.scores }));
    setRandomizeNote(`${result.method.replace('_', ' ')}: ${result.detail}`);
    setStatMethod(result.method);
    if (result.method === 'dice_rolls') {
      const scores = Object.values(result.scores).sort((a, b) => b - a);
      setRolledValues(scores);
      setRollDetails(result.detail);
    } else {
      setRolledValues([]);
      setRollDetails('');
    }
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
    sortedAbilities.forEach((ability, idx) => {
      assigned[ability] = sorted[idx] ?? 8;
    });
    setForm(f => ({ ...f, abilityScores: assigned }));
  }

  const pointBuySpent = useMemo(() => getPointBuySpent(form.abilityScores), [form.abilityScores]);
  const pointBuyRemaining = 27 - pointBuySpent;
  const statBudgetWarning = useMemo(() => getStatBudgetWarning(form.abilityScores, form.level), [form.abilityScores, form.level]);
  const expectedBudget = useMemo(() => getExpectedStatBudget(form.level), [form.level]);

  function handleClassChange(nextClass: string) {
    if (statMethod === 'standard_array') {
      setForm(f => ({ ...f, class: nextClass, abilityScores: getStandardArrayScores(nextClass) }));
      return;
    }
    set('class', nextClass);
  }

  function handleMethodChange(method: StatMethod) {
    setStatMethod(method);
    setError(null);
    setRandomizeNote('');
    if (method === 'standard_array') applyStandardArray();
    if (method === 'point_buy') setForm(f => ({ ...f, abilityScores: emptyScores(8) }));
    if (method === 'dice_rolls') {
      setRolledValues([]);
      setRollDetails('');
      setForm(f => ({ ...f, abilityScores: { ...f.abilityScores } }));
    }
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (statMethod === 'point_buy' && pointBuySpent > 27) {
      setError(`Point buy is over budget by ${pointBuySpent - 27}.`);
      return;
    }

    const profBonus = Math.ceil(form.level / 4) + 1;
    const now = new Date().toISOString();
    const candidate = {
      ...form,
      id: newId(),
      proficiencyBonus: profBonus,
      temporaryHitPoints: 0,
      source: 'manual' as const,
      createdAt: now,
    };
    const parsed = characterSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.errors[0].message); return; }

    addCharacterToActiveCampaign({
      id: parsed.data.id,
      characterName: parsed.data.characterName,
      class: parsed.data.class,
      level: parsed.data.level,
    });

    setCreated(parsed.data);
    setError(null);
  }

  if (created) {
    return (
      <div style={{
        maxWidth: 'var(--content-narrow)', margin: '0 auto',
        padding: 'var(--space-12) var(--space-6)', textAlign: 'center',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', alignItems: 'center'
      }}>
        <div style={{ fontSize: 'var(--text-xl)', color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
          {created.characterName} is ready!
        </div>
        <div className="card" style={{ width: '100%', textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
            <div><strong>Race:</strong> {created.race}</div>
            <div><strong>Class:</strong> {created.class} {created.level}</div>
            <div><strong>AC:</strong> {created.armorClass}</div>
            <div><strong>HP:</strong> {created.hitPointMaximum}</div>
            {(Object.keys(created.abilityScores) as (keyof typeof created.abilityScores)[]).map(k => (
              <div key={k}><strong>{k.toUpperCase()}:</strong> {created.abilityScores[k]} ({formatModifier(abilityModifier(created.abilityScores[k]))})</div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => navigate('/play')}>Begin Adventure &rarr;</button>
          <button className="btn btn-ghost" onClick={() => {
            setCreated(null);
            setForm({
              characterName: '', playerName: '', race: RACES[0], class: CLASSES[4],
              background: BACKGROUNDS[0], alignment: ALIGNMENTS[0], level: 1,
              abilityScores: getStandardArrayScores(CLASSES[4]), armorClass: 10, speed: 30, hitPointMaximum: 10,
              currentHitPoints: 10, equipment: '', traits: '', ideals: '', bonds: '', flaws: ''
            });
            setStatMethod('standard_array');
            setRolledValues([]);
            setRollDetails('');
            setRandomizeNote('');
          }}>
            Add Another Character
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 'var(--content-narrow)', margin: '0 auto', padding: 'var(--space-12) var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--color-primary)' }}>Character Lab</h1>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}
          onClick={() => navigate('/play')}
        >
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
          <p style={{ fontSize: 'var(--text-sm)' }}>Upload a filled D&amp;D 5e character sheet PDF.<br />PDF parsing coming in Phase 2.</p>
          <input type="file" accept=".pdf" style={{ marginTop: 'var(--space-4)' }}
            aria-label="Upload character sheet PDF"
            onChange={() => alert('PDF parsing will be available shortly.')}
          />
        </div>
      )}

      {tab === 'create' && (
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label htmlFor="charName" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Character Name *</label>
              <input id="charName" required className="input" value={form.characterName} onChange={e => set('characterName', e.target.value)} placeholder="e.g. Aric Stormborn" />
            </div>
            <div>
              <label htmlFor="playerName" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Player Name</label>
              <input id="playerName" className="input" value={form.playerName} onChange={e => set('playerName', e.target.value)} placeholder="Your name" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label htmlFor="race" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Race</label>
              <select id="race" className="input" value={form.race} onChange={e => set('race', e.target.value)}>
                {RACES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cls" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Class</label>
              <select id="cls" className="input" value={form.class} onChange={e => handleClassChange(e.target.value)}>
                {CLASSES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label htmlFor="level" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Level</label>
              <input id="level" type="number" min={1} max={20} className="input" value={form.level} onChange={e => set('level', Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="ac" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Armor Class</label>
              <input id="ac" type="number" min={0} max={30} className="input" value={form.armorClass} onChange={e => set('armorClass', Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="hp" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Max HP</label>
              <input id="hp" type="number" min={1} max={999} className="input" value={form.hitPointMaximum} onChange={e => set('hitPointMaximum', Number(e.target.value))} />
            </div>
          </div>

          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Ability Scores</legend>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <button type="button" className={`btn ${statMethod === 'standard_array' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => handleMethodChange('standard_array')}>Standard Array</button>
              <button type="button" className={`btn ${statMethod === 'point_buy' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => handleMethodChange('point_buy')}>Point Buy</button>
              <button type="button" className={`btn ${statMethod === 'dice_rolls' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => handleMethodChange('dice_rolls')}>Dice Rolls</button>
              <button type="button" className="btn btn-gold" onClick={randomizeStats}>Randomize</button>
            </div>

            {randomizeNote && (
              <div style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{randomizeNote}</div>
            )}

            {statMethod === 'point_buy' && (
              <div style={{
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-offset)',
                fontSize: 'var(--text-sm)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                  <span>Points spent</span>
                  <strong>{pointBuySpent}/27</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: pointBuyRemaining < 0 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                  <span>Remaining</span>
                  <span>{pointBuyRemaining}</span>
                </div>
              </div>
            )}

            {statMethod === 'dice_rolls' && (
              <div style={{
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-offset)',
                display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
              }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" onClick={rollStats}>Roll 4d6 Drop Lowest</button>
                  <button type="button" className="btn btn-ghost" onClick={assignRolledStats} disabled={rolledValues.length !== 6}>Assign to {form.class}</button>
                </div>
                {rolledValues.length > 0 && (
                  <>
                    <div style={{ fontSize: 'var(--text-sm)' }}>Rolled values: <strong>{rolledValues.join(', ')}</strong></div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{rollDetails}</div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
              {ABILITY_KEYS.map(k => {
                const value = form.abilityScores[k];
                const min = statMethod === 'point_buy' ? 8 : 1;
                const max = statMethod === 'point_buy' ? 15 : 30;
                return (
                  <div key={k}>
                    <label htmlFor={k} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-1)' }}>
                      {k}
                      <span title={STAT_INFO[k]} aria-label={STAT_INFO[k]} style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '16px', height: '16px', borderRadius: '50%', cursor: 'help',
                        background: 'var(--color-surface-offset)', color: 'var(--color-text-muted)',
                        fontSize: '10px', fontWeight: 700,
                      }}>i</span>
                    </label>
                    <input id={k} type="number" min={min} max={max} className="input"
                      value={value}
                      onChange={e => setAbility(k, Number(e.target.value))}
                    />
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-1)' }}>
                      {formatModifier(abilityModifier(value))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Expected total budget for level {form.level}: about {expectedBudget} ability points.
            </div>
            {statBudgetWarning && (
              <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-warning)' }}>{statBudgetWarning}</div>
            )}
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label htmlFor="bg" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Background</label>
              <select id="bg" className="input" value={form.background} onChange={e => set('background', e.target.value)}>
                {BACKGROUNDS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="align" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Alignment</label>
              <select id="align" className="input" value={form.alignment} onChange={e => set('alignment', e.target.value)}>
                {ALIGNMENTS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="traits" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Personality Traits</label>
            <textarea id="traits" className="input" rows={2} maxLength={2000} value={form.traits} onChange={e => set('traits', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}

          <button type="submit" className="btn btn-primary" style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>Create Character</button>
        </form>
      )}
    </div>
  );
}
