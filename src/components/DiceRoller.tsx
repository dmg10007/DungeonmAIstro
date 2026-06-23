import { useMemo, useRef, useState } from 'react';
import { ALL_DICE, formatModifier, roll, rollAdvantage, rollDisadvantage } from '../lib/dice';
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
  const [diceCount, setDiceCount] = useState(1);
  const [customNotation, setCustomNotation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const flashTimeoutRef = useRef<number | null>(null);

  const latest = history[0];

  const quickDice = useMemo(() => ALL_DICE.map((d) => ({
    faces: d,
    notation: `${diceCount > 1 ? diceCount : ''}d${d}`,
  })), [diceCount]);

  function pulseResult() {
    setFlash(true);
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setFlash(false), 350);
  }

  function pushResult(result: DiceRollResult) {
    setHistory((h) => [result, ...h].slice(0, 20));
    setError(null);
    pulseResult();
    onRoll?.(result);
  }

  function doRoll(notation: string) {
    try {
      const fullNotation = modifier !== 0
        ? `${notation}${modifier >= 0 ? '+' : ''}${modifier}`
        : notation;
      const result = roll(fullNotation, actorType, actorId, reason || undefined);
      pushResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid dice roll');
    }
  }

  function doAdvantage() {
    const result = rollAdvantage(reason || 'Advantage roll');
    pushResult({ ...result, actorType, actorId });
  }

  function doDisadvantage() {
    const result = rollDisadvantage(reason || 'Disadvantage roll');
    pushResult({ ...result, actorType, actorId });
  }

  function doCustomRoll() {
    if (!customNotation.trim()) return;
    doRoll(customNotation.trim());
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div
        style={{
          background: flash ? 'var(--color-primary-highlight)' : 'var(--color-surface-offset)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          textAlign: 'center',
          minHeight: '90px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: flash ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 180ms ease, background 180ms ease',
        }}
      >
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

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 110px' }}>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>Dice Count</label>
          <input
            type="number"
            min="1"
            max="20"
            value={diceCount}
            onChange={e => setDiceCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
            className="input"
            aria-label="Number of dice"
          />
        </div>
        <div style={{ flex: '0 0 110px' }}>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>Modifier</label>
          <input
            type="number"
            min="-20"
            max="20"
            value={modifier}
            onChange={e => setModifier(parseInt(e.target.value, 10) || 0)}
            className="input"
            aria-label="Dice modifier"
          />
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>Reason (optional)</label>
          <input
            type="text"
            maxLength={100}
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="input"
            placeholder="e.g. Perception check"
            aria-label="Roll reason"
          />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>Quick rolls</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {quickDice.map(({ faces, notation }) => (
            <button
              key={`${faces}-${notation}`}
              onClick={() => doRoll(notation)}
              className="btn btn-ghost"
              style={{ fontFamily: 'var(--font-display)', minWidth: '60px' }}
              aria-label={`Roll ${notation}`}
            >
              {notation}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button onClick={doAdvantage} className="btn btn-gold" style={{ flex: 1 }}>Advantage (2d20↑)</button>
        <button onClick={doDisadvantage} className="btn btn-ghost" style={{ flex: 1 }}>Disadvantage (2d20↓)</button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>Custom notation</label>
          <input
            type="text"
            value={customNotation}
            onChange={e => setCustomNotation(e.target.value)}
            className="input"
            placeholder="Examples: 2d6+3, d20, 4d8-1"
            aria-label="Custom dice notation"
            onKeyDown={e => { if (e.key === 'Enter') doCustomRoll(); }}
          />
        </div>
        <button onClick={doCustomRoll} className="btn btn-primary">Roll</button>
      </div>

      {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', margin: 0 }}>{error}</p>}

      {history.length > 1 && (
        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>Recent rolls</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {history.slice(1, 8).map((r, i) => (
              <div key={`${r.timestamp}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', gap: 'var(--space-2)' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.notation}{r.reason ? ` — ${r.reason}` : ''}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{r.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
