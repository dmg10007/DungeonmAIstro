import { useState } from 'react';
import {
  type CombatState,
  type Combatant,
  emptyCombatState,
  sortByInitiative,
  rollInitiative,
  applyDamage,
  applyHealing,
  setTempHP,
  toggleCondition,
  CONDITIONS,
} from '../lib/combat';
import { getActiveCampaignId, appendEvent } from '../lib/storage';

// ── helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return crypto.randomUUID();
}

function hpColor(current: number, max: number): string {
  const pct = current / max;
  if (pct > 0.5) return 'var(--color-success)';
  if (pct > 0.25) return 'var(--color-gold)';
  return 'var(--color-error)';
}

// ── AddCombatantForm ──────────────────────────────────────────────────────────
interface AddFormProps {
  onAdd: (c: Combatant) => void;
}
function AddCombatantForm({ onAdd }: AddFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'player' | 'npc'>('player');
  const [hpMax, setHpMax] = useState(10);
  const [ac, setAc] = useState(12);
  const [dexMod, setDexMod] = useState(0);
  const [manualInit, setManualInit] = useState('');
  const [open, setOpen] = useState(false);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { roll: rawRoll, total } = rollInitiative(dexMod);
    const initiative = manualInit !== '' ? parseInt(manualInit, 10) : total;
    const initiativeRoll = manualInit !== '' ? undefined : rawRoll;
    const combatant: Combatant = {
      id: uid(),
      name: name.trim(),
      type,
      initiative,
      initiativeRoll,
      hpMax,
      hpCurrent: hpMax,
      hpTemp: 0,
      ac,
      conditions: [],
      concentration: false,
      deathSaves: { successes: 0, failures: 0 },
      notes: '',
      dexMod,
    };
    onAdd(combatant);
    setName('');
    setManualInit('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', width: '100%' }} onClick={() => setOpen(true)}>
        + Add Combatant
      </button>
    );
  }

  return (
    <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
      <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required style={{ fontSize: 'var(--text-xs)' }} />

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {(['player', 'npc'] as const).map(t => (
          <button key={t} type="button"
            className={`btn ${type === t ? 'btn-primary' : 'btn-ghost'}`}
            style={{ flex: 1, fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }}
            onClick={() => setType(t)}>{t === 'player' ? 'Player' : 'NPC'}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-1)' }}>
        {[
          { label: 'HP', value: hpMax, min: 1, max: 999, set: setHpMax },
          { label: 'AC', value: ac, min: 0, max: 30, set: setAc },
          { label: 'DEX mod', value: dexMod, min: -5, max: 10, set: setDexMod },
        ].map(({ label, value, min, max, set }) => (
          <div key={label}>
            <div style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>{label}</div>
            <input type="number" className="input" value={value} min={min} max={max}
              onChange={e => set(Number(e.target.value))}
              style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }} />
          </div>
        ))}
        <div>
          <div style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>Init (opt)</div>
          <input type="number" className="input" value={manualInit} placeholder="auto"
            onChange={e => setManualInit(e.target.value)}
            style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button type="submit" className="btn btn-primary" style={{ flex: 1, fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }}>Add</button>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

// ── CombatantRow ──────────────────────────────────────────────────────────────
interface RowProps {
  combatant: Combatant;
  isActive: boolean;
  onChange: (updated: Combatant) => void;
  onRemove: () => void;
}
function CombatantRow({ combatant: c, isActive, onChange, onRemove }: RowProps) {
  const [hpInput, setHpInput] = useState('');
  const [tempInput, setTempInput] = useState('');
  const [showConditions, setShowConditions] = useState(false);
  const [showDeathSaves, setShowDeathSaves] = useState(false);

  const hpPct = Math.max(0, Math.min(100, (c.hpCurrent / c.hpMax) * 100));
  const isDowned = c.hpCurrent === 0;

  function applyHp(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(hpInput, 10);
    if (isNaN(val) || val === 0) return;
    onChange(val > 0 ? applyHealing(c, val) : applyDamage(c, Math.abs(val)));
    setHpInput('');
  }

  function applyTemp(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(tempInput, 10);
    if (isNaN(val) || val < 0) return;
    onChange(setTempHP(c, val));
    setTempInput('');
  }

  return (
    <div style={{
      background: isActive ? 'var(--color-primary-highlight)' : 'var(--color-surface)',
      border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2) var(--space-3)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
          {isActive && <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--text-xs)' }}>▶</span>}
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-full)', padding: '0 var(--space-2)' }}>
            {c.type === 'player' ? 'PC' : 'NPC'}
          </span>
          {c.concentration && <span title="Concentrating" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-blue)' }}>◈</span>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          <span title="Initiative">Init {c.initiative}</span>
          <span title="Armor Class">AC {c.ac}</span>
        </div>
      </div>

      {/* HP bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-1)' }}>
          <span style={{ color: isDowned ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
            HP {c.hpCurrent}/{c.hpMax}{c.hpTemp > 0 ? ` (+${c.hpTemp} temp)` : ''}
          </span>
          {isDowned && <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>Downed</span>}
        </div>
        <div style={{ height: '6px', background: 'var(--color-surface-offset-2)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${hpPct}%`, background: hpColor(c.hpCurrent, c.hpMax), borderRadius: 'var(--radius-full)', transition: 'width 0.3s ease, background 0.3s ease' }} />
        </div>
      </div>

      {/* HP input: positive = heal, negative = damage */}
      <form onSubmit={applyHp} style={{ display: 'flex', gap: 'var(--space-1)' }}>
        <input className="input" type="number" value={hpInput} onChange={e => setHpInput(e.target.value)}
          placeholder="+heal / −dmg" aria-label="HP change"
          style={{ flex: 1, fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }} />
        <button type="submit" className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }}>Apply</button>
      </form>

      {/* Temp HP */}
      <form onSubmit={applyTemp} style={{ display: 'flex', gap: 'var(--space-1)' }}>
        <input className="input" type="number" value={tempInput} onChange={e => setTempInput(e.target.value)}
          placeholder="Temp HP" aria-label="Temporary hit points"
          style={{ flex: 1, fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }} />
        <button type="submit" className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }}>Set</button>
      </form>

      {/* Active conditions */}
      {c.conditions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
          {c.conditions.map(cond => (
            <button key={cond}
              onClick={() => onChange(toggleCondition(c, cond))}
              title={`Remove ${cond}`}
              style={{
                fontSize: 'var(--text-xs)', padding: '1px var(--space-2)',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-error-highlight)',
                color: 'var(--color-error)',
                border: '1px solid var(--color-error)',
                cursor: 'pointer',
              }}>{cond} ×</button>
          ))}
        </div>
      )}

      {/* Control strip */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }}
          onClick={() => setShowConditions(s => !s)}>Conditions</button>
        {isDowned && (
          <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }}
            onClick={() => setShowDeathSaves(s => !s)}>Death Saves</button>
        )}
        <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', color: c.concentration ? 'var(--color-blue)' : undefined }}
          onClick={() => onChange({ ...c, concentration: !c.concentration })}>
          {c.concentration ? '◈ Conc.' : 'Conc.'}
        </button>
        <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', color: 'var(--color-error)', marginLeft: 'auto' }}
          onClick={onRemove} aria-label={`Remove ${c.name}`}>✕</button>
      </div>

      {/* Conditions picker */}
      {showConditions && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
          {CONDITIONS.map(cond => (
            <button key={cond}
              onClick={() => onChange(toggleCondition(c, cond))}
              style={{
                fontSize: 'var(--text-xs)', padding: '1px var(--space-2)',
                borderRadius: 'var(--radius-full)',
                background: c.conditions.includes(cond) ? 'var(--color-error-highlight)' : 'var(--color-surface-offset)',
                color: c.conditions.includes(cond) ? 'var(--color-error)' : 'var(--color-text-muted)',
                border: `1px solid ${c.conditions.includes(cond) ? 'var(--color-error)' : 'var(--color-border)'}`,
                cursor: 'pointer',
              }}>{cond}</button>
          ))}
        </div>
      )}

      {/* Death save tracker */}
      {showDeathSaves && isDowned && (
        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
          {(['successes', 'failures'] as const).map(type => (
            <div key={type}>
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
                {type === 'successes' ? '✓ Successes' : '✕ Failures'}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                {[1, 2, 3].map(n => (
                  <button key={n}
                    onClick={() => {
                      const current = c.deathSaves[type];
                      const next = current >= n ? n - 1 : n;
                      onChange({ ...c, deathSaves: { ...c.deathSaves, [type]: next } });
                    }}
                    style={{
                      width: '20px', height: '20px', borderRadius: 'var(--radius-full)',
                      background: c.deathSaves[type] >= n
                        ? (type === 'successes' ? 'var(--color-success)' : 'var(--color-error)')
                        : 'var(--color-surface-offset)',
                      border: `1px solid ${type === 'successes' ? 'var(--color-success)' : 'var(--color-error)'}`,
                      cursor: 'pointer',
                    }}
                    aria-label={`${type} ${n}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CombatTracker ─────────────────────────────────────────────────────────────
export default function CombatTracker() {
  const [combat, setCombat] = useState<CombatState>(emptyCombatState);
  const campaignId = getActiveCampaignId();

  function updateCombatant(id: string, updated: Combatant) {
    setCombat(prev => ({ ...prev, combatants: prev.combatants.map(c => c.id === id ? updated : c) }));
  }

  function removeCombatant(id: string) {
    setCombat(prev => {
      const next = prev.combatants.filter(c => c.id !== id);
      const sorted = sortByInitiative(next);
      const turn = Math.min(prev.turn, Math.max(0, sorted.length - 1));
      return { ...prev, combatants: sorted, turn };
    });
  }

  function addCombatant(c: Combatant) {
    setCombat(prev => ({ ...prev, combatants: sortByInitiative([...prev.combatants, c]) }));
  }

  function startCombat() {
    if (combat.combatants.length === 0) return;
    setCombat(prev => ({ ...prev, active: true, round: 1, turn: 0 }));
    if (campaignId) {
      appendEvent(campaignId, {
        type: 'combat_started',
        timestamp: new Date().toISOString(),
        participants: combat.combatants.map(c => c.name),
      });
    }
  }

  function nextTurn() {
    setCombat(prev => {
      const nextTurn = prev.turn + 1;
      if (nextTurn >= prev.combatants.length) {
        const nextRound = prev.round + 1;
        if (campaignId) {
          appendEvent(campaignId, {
            type: 'combat_round_advanced',
            timestamp: new Date().toISOString(),
            round: nextRound,
          });
        }
        return { ...prev, turn: 0, round: nextRound };
      }
      return { ...prev, turn: nextTurn };
    });
  }

  function endCombat() {
    if (campaignId) {
      appendEvent(campaignId, { type: 'combat_ended', timestamp: new Date().toISOString() });
    }
    setCombat(emptyCombatState());
  }

  const sorted = combat.combatants; // already sorted on add/remove
  const activeCombatant = combat.active ? sorted[combat.turn] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600 }}>
          {combat.active ? `Round ${combat.round}` : 'Combat Tracker'}
        </div>
        {combat.active && activeCombatant && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
            {activeCombatant.name}'s turn
          </div>
        )}
      </div>

      {/* Combatant list */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', padding: 'var(--space-4) 0' }}>
          No combatants yet. Add players and enemies below.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {sorted.map((c, i) => (
            <CombatantRow
              key={c.id}
              combatant={c}
              isActive={combat.active && i === combat.turn}
              onChange={updated => updateCombatant(c.id, updated)}
              onRemove={() => removeCombatant(c.id)}
            />
          ))}
        </div>
      )}

      {/* Add form */}
      {!combat.active && <AddCombatantForm onAdd={addCombatant} />}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {!combat.active ? (
          <button className="btn btn-primary" style={{ flex: 1, fontSize: 'var(--text-xs)' }}
            onClick={startCombat} disabled={sorted.length === 0}>
            ⚔️ Start Combat
          </button>
        ) : (
          <>
            <button className="btn btn-primary" style={{ flex: 1, fontSize: 'var(--text-xs)' }} onClick={nextTurn}>
              Next Turn ▶
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)' }} onClick={endCombat}>
              End
            </button>
          </>
        )}
      </div>
    </div>
  );
}
