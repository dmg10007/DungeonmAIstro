import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { characterSchema } from '../lib/schemas';
import type { Character } from '../lib/schemas';
import { newId } from '../lib/storage';
import { addCharacterToActiveCampaign } from '../lib/storageHelpers';
import { abilityModifier, formatModifier } from '../lib/dice';

const RACES = ['Human','Elf','Dwarf','Halfling','Dragonborn','Gnome','Half-Elf','Half-Orc','Tiefling'];
const CLASSES = ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
const BACKGROUNDS = ['Acolyte','Charlatan','Criminal','Entertainer','Folk Hero','Guild Artisan','Hermit','Noble','Outlander','Sage','Sailor','Soldier','Urchin'];
const ALIGNMENTS = ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'];

const DEFAULT_SCORES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

export default function CharacterLab() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'create' | 'import'>('create');
  const [form, setForm] = useState({
    characterName: '', playerName: '', race: RACES[0], class: CLASSES[4],
    background: BACKGROUNDS[0], alignment: ALIGNMENTS[0], level: 1,
    abilityScores: { ...DEFAULT_SCORES },
    armorClass: 10, speed: 30, hitPointMaximum: 10, currentHitPoints: 10,
    equipment: '', traits: '', ideals: '', bonds: '', flaws: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Character | null>(null);

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
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

    // Attach to active campaign
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
          <button className="btn btn-ghost" onClick={() => { setCreated(null); setForm({ characterName: '', playerName: '', race: RACES[0], class: CLASSES[4], background: BACKGROUNDS[0], alignment: ALIGNMENTS[0], level: 1, abilityScores: { ...DEFAULT_SCORES }, armorClass: 10, speed: 30, hitPointMaximum: 10, currentHitPoints: 10, equipment: '', traits: '', ideals: '', bonds: '', flaws: '' }); }}>
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

      {/* Tabs */}
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

          {/* Identity */}
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
              <select id="cls" className="input" value={form.class} onChange={e => set('class', e.target.value)}>
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

          {/* Ability Scores */}
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Ability Scores</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
              {(Object.keys(form.abilityScores) as (keyof typeof form.abilityScores)[]).map(k => (
                <div key={k}>
                  <label htmlFor={k} style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 'var(--space-1)' }}>{k}</label>
                  <input id={k} type="number" min={1} max={30} className="input"
                    value={form.abilityScores[k]}
                    onChange={e => set('abilityScores', { ...form.abilityScores, [k]: Number(e.target.value) })}
                  />
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-1)' }}>
                    {formatModifier(abilityModifier(form.abilityScores[k]))}
                  </div>
                </div>
              ))}
            </div>
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
