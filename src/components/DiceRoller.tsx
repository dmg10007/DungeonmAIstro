import { useState } from 'react';
import { roll, rollAdvantage, rollDisadvantage, ALL_DICE, formatModifier } from '../lib/dice';
import type { DiceRollResult } from '../lib/schemas';

interface Props {
  onRoll?: (result: DiceRollResult) => void;
  actorType?: DiceRollResult['actorType'];
  actorId?: string;
}

export default function DiceRoller({ onRoll, actorType = 'player', actorId }: Props) {
  const [history, setHistory] = useState<DiceRollResult[]>([]);
  const [modifier, setModifier] = useState(0);
  const [reason, setReason] = useState('');

  function doRoll(notation: string) {
    const fullNotation = modifier !== 0
      ? `${notation}${modifier >= 0 ? '+' : ''}${modifier}`
      : notation;
    const result = roll(fullNotation, actorType, actorId, reason || undefined);
    setHistory(h => [result, ...h].slice(0, 20));
    onRoll?.(result);
  }

  function doAdvantage() {
    const result = rollAdvantage(reason || 'Advantage roll');
    setHistory(h => [result, ...h].slice(0, 20));
    onRoll?.(result);
  }

  function doDisadvantage() {
    const result = rollDisadvantage(reason || 'Disadvantage roll');
    setHistory(h => [result, ...h].slice(0, 20));
    onRoll?.(result);
  }

  const latest = history[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Result display */}
      <div style={{
        background: 'var(--color-surface-offset)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-5)',
        textAlign: 'center',
        minHeight: '90px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {latest ? (
          <>
            <div style={{ fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-display)', color: 'var(--color-primary)', fontWeight: 700 }}>
              {latest.total}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              {latest.notation} → [{latest.rolls.join(', ')}]
              {latest.modifier !== 0 && ` ${formatModifier(latest.modifier)}`}
              {latest.reason && ` — ${latest.reason}`}
            </div>
          </>
        ) : (
          <span style={{ color: 'var(--color-text-faint)', fontSize: 'var(--text-sm)' }}>Roll a die to begin</span>
        )}
      </div>

      {/* Modifier + reason */}
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <div style={{ flex: '0 0 auto' }}>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>Modifier</label>
          <input
            type="number" min="-20" max="20"
            value={modifier}
            onChange={e => setModifier(parseInt(e.target.value, 10) || 0)}
            className="input"
            style={{ width: '80px' }}
            aria-label="Dice modifier"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>Reason (optional)</label>
          <input
            type="text" maxLength={100}
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="input"
            placeholder="e.g. Perception check"
            aria-label="Roll reason"
          />
        </div>
      </div>

      {/* Dice buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {ALL_DICE.map(d => (
          <button
            key={d}
            onClick={() => doRoll(`d${d}`)}
            className="btn btn-ghost"
            style={{ fontFamily: 'var(--font-display)', minWidth: '52px' }}
            aria-label={`Roll d${d}`}
          >
            d{d}
          </button>
        ))}
      </div>

      {/* Advantage / Disadvantage */}
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button onClick={doAdvantage} className="btn btn-gold" style={{ flex: 1 }}>Advantage (2d20↑)</button>
        <button onClick={doDisadvantage} className="btn btn-ghost" style={{ flex: 1 }}>Disadvantage (2d20↓)</button>
      </div>

      {/* Roll history */}
      {history.length > 1 && (
        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>Recent rolls</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {history.slice(1, 8).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                <span>{r.notation}</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{r.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
