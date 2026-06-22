import { useState, useCallback } from 'react';
import type { CampaignState } from '../lib/schemas';
import type { Combatant, CombatState } from '../lib/combat';
import {
  emptyCombatState, sortByInitiative, rollInitiative,
  applyDamage, applyHealing, setTempHP, toggleCondition,
  logCombatStart, logRoundAdvanced, logCombatEnd, CONDITIONS,
} from '../lib/combat';
import { saveCampaign } from '../lib/storage';

interface Props {
  campaign: CampaignState;
  onCampaignUpdate: (c: CampaignState) => void;
}

const HP_BAR_COLOR = (pct: number) => {
  if (pct > 0.6) return 'var(--color-success)';
  if (pct > 0.3) return 'var(--color-gold)';
  return 'var(--color-error)';
};

export default function CombatTracker({ campaign, onCampaignUpdate }: Props) {
  const [combat, setCombat] = useState<CombatState>(emptyCombatState);
  const [addForm, setAddForm] = useState({ name: '', type: 'npc' as 'player' | 'npc', hpMax: 10, ac: 12, dexMod: 0 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [hpInput, setHpInput] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ---- Campaign event persistence ----
  const persist = useCallback((updated: CampaignState) => {
    onCampaignUpdate(updated);
    saveCampaign(updated);
  }, [onCampaignUpdate]);

  // ---- Build combatant list from party characters ----
  function addPartyToCombat() {
    const existing = new Set(combat.combatants.map(c => c.id));
    const newCombatants: Combatant[] = campaign.characters
      .filter(ch => !existing.has(ch.id))
      .map(ch => {
        const dexMod = Math.floor((ch.abilityScores.dex - 10) / 2);
        const { total, roll: rawRoll } = rollInitiative(dexMod);
        return {
          id: ch.id,
          name: ch.characterName,
          type: 'player' as const,
          initiative: total,
          initiativeRoll: rawRoll,
          hpMax: ch.hitPointMaximum,
          hpCurrent: ch.currentHitPoints,
          hpTemp: ch.temporaryHitPoints ?? 0,
          ac: ch.armorClass,
          conditions: [],
          concentration: false,
          deathSaves: { successes: 0, failures: 0 },
          notes: '',
          dexMod,
        };
      });
    setCombat(prev => ({
      ...prev,
      combatants: sortByInitiative([...prev.combatants, ...newCombatants]),
    }));
  }

  // ---- Add NPC / custom combatant ----
  function addCombatant() {
    if (!addForm.name.trim()) return;
    const id = crypto.randomUUID();
    const { total, roll: rawRoll } = rollInitiative(addForm.dexMod);
    const c: Combatant = {
      id,
      name: addForm.name.trim(),
      type: addForm.type,
      initiative: total,
      initiativeRoll: rawRoll,
      hpMax: addForm.hpMax,
      hpCurrent: addForm.hpMax,
      hpTemp: 0,
      ac: addForm.ac,
      conditions: [],
      concentration: false,
      deathSaves: { successes: 0, failures: 0 },
      notes: '',
      dexMod: addForm.dexMod,
    };
    setCombat(prev => ({
      ...prev,
      combatants: sortByInitiative([...prev.combatants, c]),
    }));
    setAddForm({ name: '', type: 'npc', hpMax: 10, ac: 12, dexMod: 0 });
    setShowAddForm(false);
  }

  // ---- Start combat ----
  function startCombat() {
    if (combat.combatants.length === 0) return;
    const sorted = sortByInitiative(combat.combatants);
    setCombat(prev => ({ ...prev, active: true, round: 1, turn: 0, combatants: sorted }));
    const updated = logCombatStart(campaign, sorted.map(c => c.name));
    persist(updated);
  }

  // ---- Next turn ----
  function nextTurn() {
    setCombat(prev => {
      const next = prev.turn + 1;
      if (next >= prev.combatants.length) {
        const newRound = prev.round + 1;
        const updated = logRoundAdvanced(campaign, newRound);
        persist(updated);
        return { ...prev, turn: 0, round: newRound };
      }
      return { ...prev, turn: next };
    });
  }

  // ---- End combat ----
  function endCombat() {
    setCombat(emptyCombatState());
    const updated = logCombatEnd(campaign);
    persist(updated);
  }

  // ---- Remove combatant ----
  function removeCombatant(id: string) {
    setCombat(prev => ({
      ...prev,
      combatants: prev.combatants.filter(c => c.id !== id),
      turn: Math.min(prev.turn, Math.max(0, prev.combatants.length - 2)),
    }));
  }

  // ---- Update a single combatant ----
  function updateCombatant(id: string, fn: (c: Combatant) => Combatant) {
    setCombat(prev => ({
      ...prev,
      combatants: prev.combatants.map(c => c.id === id ? fn(c) : c),
    }));
  }

  // ---- HP quick-apply ----
  function applyHp(id: string, mode: 'damage' | 'heal' | 'temp') {
    const raw = parseInt(hpInput[id] ?? '', 10);
    if (isNaN(raw) || raw <= 0) return;
    updateCombatant(id, c =>
      mode === 'damage' ? applyDamage(c, raw)
      : mode === 'heal' ? applyHealing(c, raw)
      : setTempHP(c, raw)
    );
    setHpInput(prev => ({ ...prev, [id]: '' }));
  }

  // ---- Death save ----
  function tickDeathSave(id: string, which: 'successes' | 'failures') {
    updateCombatant(id, c => ({
      ...c,
      deathSaves: {
        ...c.deathSaves,
        [which]: Math.min(3, c.deathSaves[which] + 1),
      },
    }));
  }
  function resetDeathSaves(id: string) {
    updateCombatant(id, c => ({ ...c, deathSaves: { successes: 0, failures: 0 } }));
  }

  const activeCombatant = combat.active ? combat.combatants[combat.turn] : null;

  // ---- Empty state ----
  if (!combat.active && combat.combatants.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{
          background: 'var(--color-surface-offset)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>⚔️</div>
          <h3 style={{ marginBottom: 'var(--space-2)', fontFamily: 'var(--font-display)' }}>No combatants yet</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)' }}>
            Add your party and any NPCs or monsters, then roll for initiative.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
            {campaign.characters.length > 0 && (
              <button className="btn btn-primary" onClick={addPartyToCombat}>Add Party ({campaign.characters.length})</button>
            )}
            <button className="btn btn-ghost" onClick={() => setShowAddForm(true)}>+ Add Combatant</button>
          </div>
        </div>
        {showAddForm && <AddForm form={addForm} setForm={setAddForm} onAdd={addCombatant} onCancel={() => setShowAddForm(false)} />}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: combat.active ? 'var(--color-error-highlight)' : 'var(--color-surface-offset)',
        border: `1px solid ${combat.active ? 'var(--color-error)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3) var(--space-5)',
        flexWrap: 'wrap', gap: 'var(--space-3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>
            {combat.active ? `⚔️ Round ${combat.round}` : '⚔️ Setup'}
          </span>
          {combat.active && activeCombatant && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Current: <strong style={{ color: 'var(--color-text)' }}>{activeCombatant.name}</strong>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {!combat.active && (
            <>
              <button className="btn btn-ghost" onClick={() => setShowAddForm(s => !s)}>+ Add</button>
              {campaign.characters.length > 0 && (
                <button className="btn btn-ghost" onClick={addPartyToCombat}>+ Party</button>
              )}
              <button className="btn btn-primary" onClick={startCombat} disabled={combat.combatants.length === 0}>
                Start Combat
              </button>
            </>
          )}
          {combat.active && (
            <>
              <button className="btn btn-primary" onClick={nextTurn}>Next Turn →</button>
              <button className="btn btn-ghost" style={{ color: 'var(--color-error)' }} onClick={endCombat}>End Combat</button>
            </>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAddForm && !combat.active && (
        <AddForm form={addForm} setForm={setAddForm} onAdd={addCombatant} onCancel={() => setShowAddForm(false)} />
      )}

      {/* Combatant list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {combat.combatants.map((c, idx) => {
          const isActive = combat.active && idx === combat.turn;
          const hpPct = c.hpMax > 0 ? c.hpCurrent / c.hpMax : 0;
          const isExpanded = expandedId === c.id;
          return (
            <div key={c.id} style={{
              background: isActive ? 'var(--color-primary-highlight)' : 'var(--color-surface)',
              border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
              transition: 'all var(--transition-interactive)',
            }}>
              {/* Main row */}
              <div
                style={{ padding: 'var(--space-3) var(--space-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                role="button" aria-expanded={isExpanded} aria-label={`Expand ${c.name}`}
              >
                {/* Initiative badge */}
                <div style={{
                  minWidth: '44px', height: '44px', borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-offset)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                }}>
                  <span style={{ fontSize: 'var(--text-lg)', lineHeight: 1 }}>{c.initiative}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>init</span>
                </div>

                {/* Name + type badge */}
                <div style={{ flex: '1 1 120px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{c.name}</span>
                    <span style={{
                      fontSize: 'var(--text-xs)', padding: '2px 6px',
                      borderRadius: 'var(--radius-full)',
                      background: c.type === 'player' ? 'var(--color-primary-highlight)' : 'var(--color-warning-highlight)',
                      color: c.type === 'player' ? 'var(--color-primary)' : 'var(--color-warning)',
                      fontWeight: 600,
                    }}>{c.type === 'player' ? 'PC' : 'NPC'}</span>
                    {isActive && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-primary)', fontWeight: 700 }}>◀ ACTIVE</span>}
                  </div>
                  {/* Conditions */}
                  {c.conditions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
                      {c.conditions.map(cond => (
                        <span key={cond} style={{
                          fontSize: '10px', padding: '1px 5px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--color-error-highlight)',
                          color: 'var(--color-error)', fontWeight: 600,
                        }}>{cond}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* HP bar + numbers */}
                <div style={{ flex: '0 0 160px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>HP</span>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {c.hpCurrent}/{c.hpMax}
                      {c.hpTemp > 0 && <span style={{ color: 'var(--color-blue)', marginLeft: 4 }}>+{c.hpTemp}</span>}
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.max(0, Math.min(100, hpPct * 100))}%`,
                      background: HP_BAR_COLOR(hpPct),
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.3s ease, background 0.3s ease',
                    }} />
                  </div>
                </div>

                {/* AC */}
                <div style={{ textAlign: 'center', minWidth: '44px' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>AC</div>
                  <div style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{c.ac}</div>
                </div>

                {/* Remove */}
                <button
                  onClick={e => { e.stopPropagation(); removeCombatant(c.id); }}
                  aria-label={`Remove ${c.name}`}
                  style={{ color: 'var(--color-text-faint)', padding: 'var(--space-1)', borderRadius: 'var(--radius-sm)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{
                  borderTop: '1px solid var(--color-divider)',
                  padding: 'var(--space-4)',
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
                  background: 'var(--color-surface-2)',
                }}>
                  {/* HP controls */}
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>HP</div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="number" min="1" max="999"
                        className="input" style={{ width: '80px' }}
                        placeholder="Amt"
                        value={hpInput[c.id] ?? ''}
                        onChange={e => setHpInput(prev => ({ ...prev, [c.id]: e.target.value }))}
                        aria-label="HP amount"
                        onClick={e => e.stopPropagation()}
                      />
                      <button className="btn btn-ghost" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }} onClick={e => { e.stopPropagation(); applyHp(c.id, 'damage'); }}>Damage</button>
                      <button className="btn btn-ghost" style={{ color: 'var(--color-success)', fontSize: 'var(--text-sm)' }} onClick={e => { e.stopPropagation(); applyHp(c.id, 'heal'); }}>Heal</button>
                      <button className="btn btn-ghost" style={{ color: 'var(--color-blue)', fontSize: 'var(--text-sm)' }} onClick={e => { e.stopPropagation(); applyHp(c.id, 'temp'); }}>Temp HP</button>
                    </div>
                  </div>

                  {/* Conditions */}
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conditions</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
                      {CONDITIONS.map(cond => {
                        const active = c.conditions.includes(cond);
                        return (
                          <button key={cond}
                            onClick={e => { e.stopPropagation(); updateCombatant(c.id, cc => toggleCondition(cc, cond)); }}
                            style={{
                              fontSize: '11px', padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              border: `1px solid ${active ? 'var(--color-error)' : 'var(--color-border)'}`,
                              background: active ? 'var(--color-error-highlight)' : 'transparent',
                              color: active ? 'var(--color-error)' : 'var(--color-text-muted)',
                              cursor: 'pointer', fontWeight: active ? 700 : 400,
                              transition: 'all var(--transition-interactive)',
                            }}
                            aria-pressed={active}
                            aria-label={`Toggle ${cond} condition`}
                          >{cond}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Concentration + Death Saves */}
                  <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Concentration</div>
                      <button
                        onClick={e => { e.stopPropagation(); updateCombatant(c.id, cc => ({ ...cc, concentration: !cc.concentration })); }}
                        style={{
                          padding: 'var(--space-2) var(--space-4)',
                          borderRadius: 'var(--radius-md)',
                          border: `1px solid ${c.concentration ? 'var(--color-purple)' : 'var(--color-border)'}`,
                          background: c.concentration ? 'var(--color-purple-highlight)' : 'transparent',
                          color: c.concentration ? 'var(--color-purple)' : 'var(--color-text-muted)',
                          fontSize: 'var(--text-sm)', cursor: 'pointer', fontWeight: c.concentration ? 700 : 400,
                        }}
                        aria-pressed={c.concentration}
                        aria-label="Toggle concentration"
                      >
                        {c.concentration ? '🔮 Concentrating' : 'Not concentrating'}
                      </button>
                    </div>

                    {c.hpCurrent === 0 && (
                      <div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Death Saves</div>
                        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <button className="btn btn-ghost" style={{ color: 'var(--color-success)', fontSize: 'var(--text-xs)' }}
                              onClick={e => { e.stopPropagation(); tickDeathSave(c.id, 'successes'); }}
                              aria-label="Add death save success">
                              ✓ Success
                            </button>
                            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--color-success)' }}>{c.deathSaves.successes}/3</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <button className="btn btn-ghost" style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)' }}
                              onClick={e => { e.stopPropagation(); tickDeathSave(c.id, 'failures'); }}
                              aria-label="Add death save failure">
                              ✗ Failure
                            </button>
                            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--color-error)' }}>{c.deathSaves.failures}/3</span>
                          </div>
                          <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }}
                            onClick={e => { e.stopPropagation(); resetDeathSaves(c.id); }}
                            aria-label="Reset death saves">
                            Reset
                          </button>
                        </div>
                        {c.deathSaves.successes >= 3 && <div style={{ color: 'var(--color-success)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', fontWeight: 700 }}>Stabilized!</div>}
                        {c.deathSaves.failures >= 3 && <div style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-1)', fontWeight: 700 }}>Dead 💀</div>}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      htmlFor={`notes-${c.id}`}>Notes</label>
                    <textarea
                      id={`notes-${c.id}`}
                      className="input"
                      rows={2}
                      maxLength={300}
                      placeholder="Spell slots used, concentration target, etc."
                      value={c.notes}
                      onChange={e => updateCombatant(c.id, cc => ({ ...cc, notes: e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Add combatant form ----
interface AddFormProps {
  form: { name: string; type: 'player' | 'npc'; hpMax: number; ac: number; dexMod: number };
  setForm: React.Dispatch<React.SetStateAction<AddFormProps['form']>>;
  onAdd: () => void;
  onCancel: () => void;
}

function AddForm({ form, setForm, onAdd, onCancel }: AddFormProps) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-4)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
    }}>
      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Add Combatant</div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px' }}>
          <label className="field-label" htmlFor="add-name">Name</label>
          <input id="add-name" className="input" maxLength={100}
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Goblin Archer" aria-required="true" />
        </div>
        <div style={{ flex: '0 0 110px' }}>
          <label className="field-label" htmlFor="add-type">Type</label>
          <select id="add-type" className="input"
            value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'player' | 'npc' }))}
            aria-label="Combatant type">
            <option value="npc">NPC/Monster</option>
            <option value="player">Player</option>
          </select>
        </div>
        <div style={{ flex: '0 0 80px' }}>
          <label className="field-label" htmlFor="add-hp">HP</label>
          <input id="add-hp" type="number" min="1" max="999" className="input"
            value={form.hpMax} onChange={e => setForm(f => ({ ...f, hpMax: parseInt(e.target.value, 10) || 1 }))} />
        </div>
        <div style={{ flex: '0 0 70px' }}>
          <label className="field-label" htmlFor="add-ac">AC</label>
          <input id="add-ac" type="number" min="0" max="30" className="input"
            value={form.ac} onChange={e => setForm(f => ({ ...f, ac: parseInt(e.target.value, 10) || 0 }))} />
        </div>
        <div style={{ flex: '0 0 90px' }}>
          <label className="field-label" htmlFor="add-dex">DEX Mod</label>
          <input id="add-dex" type="number" min="-5" max="10" className="input"
            value={form.dexMod} onChange={e => setForm(f => ({ ...f, dexMod: parseInt(e.target.value, 10) || 0 }))} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn btn-primary" onClick={onAdd}>Add & Roll Initiative</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
