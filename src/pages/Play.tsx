import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import DiceRoller from '../components/DiceRoller';
import CombatTracker from '../components/CombatTracker';
import { getActiveCampaignId, loadCampaign, loadCharacter, appendEvent } from '../lib/storage';
import { listVaultEntries } from '../lib/vault';
import { sendToDM } from '../lib/dm';
import { roll, abilityModifier, formatModifier } from '../lib/dice';
import type { Character, DiceRollResult } from '../lib/schemas';

interface Message {
  role: 'user' | 'assistant' | 'event';
  content: string;
  timestamp: string;
}

const RULES_LABELS: Record<number, string> = {
  1: 'By the Book', 2: 'Mostly RAW', 3: 'Balanced', 4: 'Flexible', 5: 'Rule of Cool',
};
const NARRATIVE_LABELS: Record<number, string> = {
  1: 'Pure Narrative', 2: 'Story-first', 3: 'Balanced', 4: 'Dice-leaning', 5: 'Dice Heavy',
};
const VERBOSITY_LABELS: Record<number, string> = {
  1: 'Terse', 2: 'Concise', 3: 'Balanced', 4: 'Rich', 5: 'Verbose',
};

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

function detectCrit(result: DiceRollResult): 'nat20' | 'nat1' | null {
  if (!result.notation.toLowerCase().includes('d20')) return null;
  if (result.rolls.includes(20)) return 'nat20';
  if (result.rolls.includes(1)) return 'nat1';
  return null;
}

function buildCritMessage(result: DiceRollResult, critType: 'nat20' | 'nat1'): string {
  const tag = critType === 'nat20' ? '[CRIT SUCCESS — Natural 20]' : '[CRIT FAILURE — Natural 1]';
  const label = result.reason ? ` on ${result.reason}` : '';
  const rollStr = result.rolls.length > 1
    ? `rolled [${result.rolls.join(', ')}] (${critType === 'nat20' ? 'taking the highest' : 'taking the lowest'}), total ${result.total}`
    : `rolled ${result.total}`;
  return `${tag} I just ${rollStr}${label}. Please narrate a ${critType === 'nat20' ? 'spectacular critical success' : 'catastrophic critical failure'} for this action as described in your critical roll rules — unique, memorable, and without modifying any ability scores or stats.`;
}

function buildRollNotifyMessage(result: DiceRollResult): string {
  const label = result.reason ? ` for ${result.reason}` : '';
  return `[DICE ROLL] I rolled ${result.notation}${label}: final result is ${result.total} (already includes all modifiers). Please incorporate this result into the narrative as appropriate — do NOT add any additional modifiers.`;
}

const SLASH_RE = /^\/(?:roll|r)\s+(.*)/i;
const ADV_SHORTHAND = /^\/adv(?:antage)?\s*(.*)/i;
const DIS_SHORTHAND = /^\/dis(?:advantage)?\s*(.*)/i;
const NOTATION_RE = /^(\d{1,2})?d(4|6|8|10|12|20|100)([+-]\d{1,3})?/i;

interface SlashRollParsed {
  type: 'roll';
  notation: string;
  reason: string;
  advantage: boolean;
  disadvantage: boolean;
}

function parseSlashCommand(text: string): SlashRollParsed | null {
  const trimmed = text.trim();
  const advMatch = trimmed.match(ADV_SHORTHAND);
  if (advMatch) return { type: 'roll', notation: 'd20', reason: advMatch[1].trim() || 'Advantage', advantage: true, disadvantage: false };
  const disMatch = trimmed.match(DIS_SHORTHAND);
  if (disMatch) return { type: 'roll', notation: 'd20', reason: disMatch[1].trim() || 'Disadvantage', advantage: false, disadvantage: true };
  const rollMatch = trimmed.match(SLASH_RE);
  if (!rollMatch) return null;
  const rest = rollMatch[1].trim();
  if (/^adv(?:antage)?\s*/i.test(rest)) {
    const reason = rest.replace(/^adv(?:antage)?\s*/i, '').trim();
    return { type: 'roll', notation: 'd20', reason: reason || 'Advantage', advantage: true, disadvantage: false };
  }
  if (/^dis(?:advantage)?\s*/i.test(rest)) {
    const reason = rest.replace(/^dis(?:advantage)?\s*/i, '').trim();
    return { type: 'roll', notation: 'd20', reason: reason || 'Disadvantage', advantage: false, disadvantage: true };
  }
  const notationMatch = rest.match(NOTATION_RE);
  if (notationMatch) {
    const notation = notationMatch[0];
    const reason = rest.slice(notation.length).trim();
    return { type: 'roll', notation, reason, advantage: false, disadvantage: false };
  }
  return null;
}

function renderMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br />');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'blockquote', 'br'],
    ALLOWED_ATTR: [],
  });
}

function SlashHint({ input }: { input: string }) {
  if (!input.startsWith('/')) return null;
  const parsed = parseSlashCommand(input);
  const examples = [
    '/roll d20', '/roll 2d6+3', '/roll d20-1 stealth',
    '/adv perception', '/dis athletics',
  ];
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
      fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
      display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
    }}>
      {parsed ? (
        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
          ✓ Will roll: {parsed.advantage ? '2d20 advantage' : parsed.disadvantage ? '2d20 disadvantage' : parsed.notation}
          {parsed.reason ? ` — ${parsed.reason}` : ''}
        </span>
      ) : (
        <span style={{ color: 'var(--color-warning)' }}>⚠ Unrecognised command</span>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
        {examples.map(ex => (
          <code key={ex} style={{ background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-sm)', padding: '1px var(--space-2)' }}>{ex}</code>
        ))}
      </div>
    </div>
  );
}

function PassphraseModal({ onSubmit, onCancel, error }: {
  onSubmit: (p: string) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pp-title" style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'oklch(from var(--color-bg) l c h / 0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div>
          <div id="pp-title" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-1)' }}>Unlock Vault</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Enter your vault passphrase to decrypt your API key for this session.</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (value.length >= 8) onSubmit(value); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <input ref={inputRef} type="password" className="input" placeholder="Vault passphrase"
            value={value} onChange={e => setValue(e.target.value)}
            autoComplete="current-password" aria-label="Vault passphrase"
          />
          {error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="submit" className="btn btn-primary" disabled={value.length < 8} style={{ flex: 1 }}>Unlock</button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CharacterSheet({ character }: { character: Character }) {
  const scores = character.abilityScores;

  if (!scores || typeof scores.dex === 'undefined') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', color: 'var(--color-primary)', fontWeight: 700 }}>
          {character.characterName}
        </div>
        <div style={{ color: 'var(--color-text-muted)' }}>
          {character.race} {character.class} · Level {character.level}
        </div>
        <div style={{ color: 'var(--color-warning)', background: 'var(--color-warning-highlight)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
          ⚠ Ability scores are missing from this character's saved data. Re-create or re-save the character to fix this.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', color: 'var(--color-primary)', fontWeight: 700, marginBottom: 2 }}>
          {character.characterName}
        </div>
        <div style={{ color: 'var(--color-text-muted)' }}>
          {character.race} {character.class} · Level {character.level}
          {character.background ? ` · ${character.background}` : ''}
        </div>
        {character.alignment && (
          <div style={{ color: 'var(--color-text-faint)', marginTop: 2 }}>{character.alignment}</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
        {([
          { label: 'AC',      value: character.armorClass },
          { label: 'HP',      value: `${character.currentHitPoints}/${character.hitPointMaximum}` },
          { label: 'Speed',   value: `${character.speed}ft` },
          { label: 'Prof',    value: `+${character.proficiencyBonus}` },
          { label: 'Init',    value: formatModifier(character.initiative ?? abilityModifier(scores.dex)) },
          { label: 'Temp HP', value: character.temporaryHitPoints ?? 0 },
        ] as { label: string; value: string | number }[]).map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px', marginBottom: 'var(--space-2)' }}>Ability Scores</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          {ABILITY_KEYS.map(k => {
            const score = scores[k];
            const mod = abilityModifier(score);
            return (
              <div key={k} style={{ background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{score}</div>
                <div style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '10px' }}>{formatModifier(mod)}</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ABILITY_LABELS[k]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {character.spellcastingClass && (
        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px', marginBottom: 'var(--space-2)' }}>Spellcasting</div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {character.spellcastingAbility && <span><strong>{character.spellcastingAbility.toUpperCase()}</strong> ability</span>}
            {character.spellSaveDC != null && <span>Save DC <strong>{character.spellSaveDC}</strong></span>}
            {character.spellAttackBonus != null && <span>Atk <strong>{formatModifier(character.spellAttackBonus)}</strong></span>}
          </div>
        </div>
      )}

      {character.equipment && (
        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px', marginBottom: 4 }}>Equipment</div>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0, maxWidth: '100%', wordBreak: 'break-word' }}>{character.equipment}</p>
        </div>
      )}

      {character.traits && (
        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-2)' }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px', marginBottom: 4 }}>Traits</div>
          <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0, maxWidth: '100%', wordBreak: 'break-word' }}>{character.traits}</p>
        </div>
      )}
    </div>
  );
}

export default function Play() {
  const navigate = useNavigate();
  const campaignId = getActiveCampaignId();
  const campaign = campaignId ? loadCampaign(campaignId) : null;
  const activeCharacter: Character | null = loadCharacter();

  const [messages, setMessages] = useState<Message[]>(
    campaign?.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp }))
    ?? []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [panel, setPanel] = useState<'dice' | 'combat' | 'sheet' | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [pendingInput, setPendingInput] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);
  const [notifyDMOnRoll, setNotifyDMOnRoll] = useState(false);
  const passphraseRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const vaultEntries = listVaultEntries();
  const hasKey = vaultEntries.length > 0;

  const rulesLabel = useMemo(() => RULES_LABELS[campaign?.options.rulesStrictness ?? 3], [campaign?.options.rulesStrictness]);
  const narrativeLabel = useMemo(() => NARRATIVE_LABELS[campaign?.options.narrativeStyle ?? 3], [campaign?.options.narrativeStyle]);
  const verbosityLabel = useMemo(() => VERBOSITY_LABELS[campaign?.options.responseVerbosity ?? 3], [campaign?.options.responseVerbosity]);

  if (!campaign) {
    return (
      <div style={{
        maxWidth: 'var(--content-narrow)', margin: '0 auto',
        padding: 'var(--space-16) var(--space-6)', textAlign: 'center',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center',
      }}>
        <div style={{ fontSize: '3rem' }}>🏰</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--color-primary)' }}>No Active Campaign</h1>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '36ch' }}>Configure your adventure first, then return here to play.</p>
        <button className="btn btn-primary" onClick={() => navigate('/setup')}>Begin an Adventure &rarr;</button>
      </div>
    );
  }

  async function doSendSilent(text: string, passphrase: string) {
    await doSend(text, passphrase, false, false);
  }

  async function doSend(text: string, passphrase: string, persist = true, showInChat = true) {
    if (!text.trim() || loading) return;
    setLoading(true);
    setDmError(null);
    setStreamingText('');
    if (showInChat) {
      const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
      setMessages(m => [...m, userMsg]);
    }
    abortRef.current = new AbortController();
    await sendToDM(
      text.trim(), passphrase,
      (chunk) => setStreamingText(t => t + chunk),
      (fullText) => {
        setStreamingText('');
        setMessages(m => [...m, { role: 'assistant', content: fullText, timestamp: new Date().toISOString() }]);
        setLoading(false);
      },
      (msg) => {
        setStreamingText('');
        setDmError(msg);
        if (msg.includes('passphrase') || msg.includes('expired')) passphraseRef.current = null;
        setLoading(false);
      },
      abortRef.current.signal,
      persist,
    );
  }

  function executeSlashRoll(parsed: SlashRollParsed) {
    try {
      let result: DiceRollResult;
      if (parsed.advantage) {
        const r1 = roll('d20', 'player', undefined, parsed.reason || 'Advantage');
        const r2 = roll('d20', 'player', undefined, parsed.reason || 'Advantage');
        const winner = r1.total >= r2.total ? r1 : r2;
        result = { ...winner, notation: '2d20kh1', rolls: [r1.total, r2.total], reason: parsed.reason || 'Advantage' };
      } else if (parsed.disadvantage) {
        const r1 = roll('d20', 'player', undefined, parsed.reason || 'Disadvantage');
        const r2 = roll('d20', 'player', undefined, parsed.reason || 'Disadvantage');
        const loser = r1.total <= r2.total ? r1 : r2;
        result = { ...loser, notation: '2d20kl1', rolls: [r1.total, r2.total], reason: parsed.reason || 'Disadvantage' };
      } else {
        result = roll(parsed.notation, 'player', undefined, parsed.reason || undefined);
      }
      handleDiceRoll(result);
    } catch (e) {
      setDmError(`Dice error: ${(e as Error).message}`);
    }
  }

  function handleSend() {
    if (!input.trim() || loading || !hasKey) return;
    const text = input.trim();
    const slash = parseSlashCommand(text);
    if (slash) { setInput(''); executeSlashRoll(slash); return; }
    setInput('');
    if (passphraseRef.current) { doSend(text, passphraseRef.current); return; }
    setPendingInput(text);
    setPassphraseError(null);
    setShowPassphrase(true);
  }

  function handleOpenScene() {
    if (loading || !hasKey) return;
    if (passphraseRef.current) { doSend('__OPEN_SCENE__', passphraseRef.current); return; }
    setPendingInput('__OPEN_SCENE__');
    setPassphraseError(null);
    setShowPassphrase(true);
  }

  function handlePassphraseSubmit(passphrase: string) {
    passphraseRef.current = passphrase;
    setShowPassphrase(false);
    setPassphraseError(null);
    doSend(pendingInput, passphrase);
    setPendingInput('');
  }

  function handleDiceRoll(result: DiceRollResult) {
    if (!campaignId) return;
    appendEvent(campaignId, { type: 'dice_rolled', timestamp: result.timestamp, result });
    const crit = detectCrit(result);
    let eventLabel = '';
    if (crit === 'nat20') eventLabel = ' ✨ CRITICAL SUCCESS!';
    else if (crit === 'nat1') eventLabel = ' 💀 CRITICAL FAILURE!';
    setMessages(m => [...m, {
      role: 'event',
      content: `🎲 **${result.actorType === 'player' ? 'You rolled' : 'Rolled'}** ${result.notation}: **${result.total}** [${result.rolls.join(', ')}]${result.reason ? ` — *${result.reason}*` : ''}${eventLabel}`,
      timestamp: result.timestamp,
    }]);
    if (crit) {
      const critMsg = buildCritMessage(result, crit);
      if (passphraseRef.current) { doSend(critMsg, passphraseRef.current, false); }
      else { setPendingInput(critMsg); setPassphraseError(null); setShowPassphrase(true); }
    } else if (notifyDMOnRoll) {
      const notifyMsg = buildRollNotifyMessage(result);
      if (passphraseRef.current) { doSendSilent(notifyMsg, passphraseRef.current); }
      else { setPendingInput(notifyMsg); setPassphraseError(null); setShowPassphrase(true); }
    }
  }

  const isSlashMode = input.startsWith('/');

  return (
    <>
      {showPassphrase && (
        <PassphraseModal
          onSubmit={handlePassphraseSubmit}
          onCancel={() => { setShowPassphrase(false); setPendingInput(''); }}
          error={passphraseError}
        />
      )}

      <div className="play-grid">

        {/* ── Chat column ── */}
        <div className="play-chat-col">
          {/* Header: title + badge + Open Scene */}
          <div className="play-chat-header">
            <h1 className="play-title">{campaign.title}</h1>
            <span className="badge">{campaign.options.mode === 'one_shot' ? 'One-shot' : 'Campaign'}</span>
            <button className="btn btn-gold" onClick={handleOpenScene} disabled={!hasKey || loading}>Open Scene</button>
          </div>

          {!hasKey && (
            <div role="alert" style={{
              background: 'var(--color-warning-highlight)', border: '1px solid var(--color-warning)',
              borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--text-sm)', color: 'var(--color-warning)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 'var(--space-3)', flexShrink: 0,
            }}>
              <span>⚠ No LLM key configured — the DM can't respond yet.</span>
              <Link to="/settings" style={{ color: 'var(--color-warning)', fontWeight: 600, textDecoration: 'underline' }}>Add key in Settings</Link>
            </div>
          )}

          {dmError && (
            <div role="alert" style={{
              background: 'var(--color-error-highlight)', border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--text-sm)', color: 'var(--color-error)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            }}>
              <span>{dmError}</span>
              <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }} onClick={() => setDmError(null)}>×</button>
            </div>
          )}

          {/* Message feed */}
          <div style={{
            flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
            gap: 'var(--space-4)', paddingRight: 'var(--space-2)', minHeight: 0,
          }}>
            {messages.length === 0 && !streamingText && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-16) var(--space-8)' }}>
                <div style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Your adventure awaits</div>
                <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>Type a message or open the first scene to begin.</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', marginBottom: 'var(--space-4)' }}>
                  Tip: type <code style={{ background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-sm)', padding: '1px 4px' }}>/roll d20</code> or <code style={{ background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-sm)', padding: '1px 4px' }}>/adv perception</code> to roll dice inline
                </p>
                <button className="btn btn-primary" onClick={handleOpenScene} disabled={!hasKey || loading}>Start with the opening scene</button>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === 'event') {
                const isCritSuccess = m.content.includes('CRITICAL SUCCESS');
                const isCritFail = m.content.includes('CRITICAL FAILURE');
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-full)',
                      background: isCritSuccess ? 'var(--color-gold-highlight)' : isCritFail ? 'var(--color-error-highlight)' : 'var(--color-surface-offset)',
                      border: `1px solid ${isCritSuccess ? 'var(--color-gold)' : isCritFail ? 'var(--color-error)' : 'var(--color-border)'}`,
                      fontSize: 'var(--text-xs)',
                      color: isCritSuccess ? 'var(--color-gold)' : isCritFail ? 'var(--color-error)' : 'var(--color-text-muted)',
                      fontWeight: (isCritSuccess || isCritFail) ? 700 : 400,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                    />
                  </div>
                );
              }
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 'var(--space-1)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>{m.role === 'user' ? 'You' : '🏰 DM'}</div>
                  <div
                    style={{
                      maxWidth: '80%', padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      background: m.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: m.role === 'user' ? 'var(--color-text-inverse)' : 'var(--color-text)',
                      border: m.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                      fontSize: 'var(--text-sm)', wordBreak: 'break-word', lineHeight: 1.6,
                    }}
                    dangerouslySetInnerHTML={{ __html: m.role === 'assistant' ? renderMarkdown(m.content) : DOMPurify.sanitize(m.content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) }}
                  />
                </div>
              );
            })}

            {streamingText && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>🏰 DM</div>
                <div style={{
                  maxWidth: '80%', padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)', fontSize: 'var(--text-sm)',
                  wordBreak: 'break-word', lineHeight: 1.6,
                }}
                dangerouslySetInnerHTML={{ __html: `${renderMarkdown(streamingText)}<span style="opacity:0.5">&#9646;</span>` }}
                />
              </div>
            )}

            {loading && !streamingText && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  The DM is thinking<span style={{ animation: 'blink 1s step-start infinite' }}>...</span>
                </div>
                <button className="btn btn-ghost" onClick={() => abortRef.current?.abort()}>Cancel</button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {isSlashMode && <SlashHint input={input} />}
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={hasKey ? 'What do you do? · /roll 2d6+3 · /adv perception · /dis stealth' : 'Add an API key in Settings to start playing...'}
                className="input" rows={2} style={{ flex: 1, resize: 'none' }}
                aria-label="Message to the DM" disabled={!hasKey}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim() || !hasKey}
                className={isSlashMode ? 'btn btn-gold' : 'btn btn-primary'}
                aria-label={isSlashMode ? 'Execute roll' : 'Send message'}
              >
                {isSlashMode ? '🎲 Roll' : loading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="play-sidebar">

          {/* Tool panel toggle buttons */}
          <div className="play-sidebar-btns">
            <button className={`btn ${panel === 'dice' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPanel(p => p === 'dice' ? null : 'dice')}>🎲 Dice</button>
            <button className={`btn ${panel === 'combat' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPanel(p => p === 'combat' ? null : 'combat')}>⚔ Combat</button>
            {activeCharacter && (
              <button
                className={`btn ${panel === 'sheet' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPanel(p => p === 'sheet' ? null : 'sheet')}
                title="Character Sheet"
              >📋 Sheet</button>
            )}
          </div>

          {panel === 'dice' && (
            <div className="card">
              <DiceRoller onRoll={handleDiceRoll} actorType="player" />
            </div>
          )}
          {panel === 'combat' && (
            <div className="card">
              <CombatTracker />
            </div>
          )}
          {panel === 'sheet' && activeCharacter && (
            <div className="card">
              <CharacterSheet character={activeCharacter} />
            </div>
          )}

          {/* Notify DM toggle */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Notify DM on roll</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {notifyDMOnRoll ? 'Every roll sends a note to the DM' : 'Only crits auto-notify the DM'}
              </div>
            </div>
            <button
              role="switch" aria-checked={notifyDMOnRoll} aria-label="Notify DM on every roll"
              onClick={() => setNotifyDMOnRoll(v => !v)}
              style={{
                width: '44px', height: '24px', borderRadius: 'var(--radius-full)',
                background: notifyDMOnRoll ? 'var(--color-primary)' : 'var(--color-border)',
                position: 'relative', flexShrink: 0, transition: 'background 180ms ease',
                border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{
                position: 'absolute', top: '3px', left: notifyDMOnRoll ? '23px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                transition: 'left 180ms ease', boxShadow: '0 1px 3px oklch(0 0 0 / 0.2)',
              }} />
            </button>
          </div>

          {/* Party */}
          {campaign.characters.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Party</div>
              {campaign.characters.map(c => (
                <div key={c.id} style={{ fontSize: 'var(--text-xs)', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{c.characterName}</span>
                  <span style={{ flexShrink: 0 }}>{c.class} {c.level}</span>
                </div>
              ))}
            </div>
          )}

          {/* Campaign info */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>Campaign</div>
            <div>Mode: {campaign.options.mode === 'one_shot' ? 'One-shot' : 'Campaign'}</div>
            <div>Tone: {campaign.options.tone.join(', ')}</div>
            <div>Experience: {campaign.options.experienceLevel}</div>
            <div>Rules: {rulesLabel}</div>
            <div>Narrative: {narrativeLabel}</div>
            <div>Verbosity: {verbosityLabel}</div>
            <div>Safety: {campaign.options.safetyMode}</div>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-1) var(--space-2)' }}
              onClick={() => navigate('/setup')}
            >New Adventure</button>
          </div>

          {/* Slash reference */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>/ Commands</div>
            {[
              ['/roll d20', 'Roll a d20'],
              ['/roll 2d6+3', 'Roll 2d6+3'],
              ['/roll d20-1', 'Named roll'],
              ['/adv perception', 'Advantage'],
              ['/dis athletics', 'Disadvantage'],
            ].map(([cmd, desc]) => (
              <div key={cmd} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', overflow: 'hidden' }}>
                <code style={{ background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-sm)', padding: '1px var(--space-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 1 }}>{cmd}</code>
                <span style={{ color: 'var(--color-text-faint)', flexShrink: 0 }}>{desc}</span>
              </div>
            ))}
            <div style={{ marginTop: 'var(--space-1)', padding: 'var(--space-2)', background: 'var(--color-gold-highlight)', borderRadius: 'var(--radius-sm)', color: 'var(--color-gold)', fontWeight: 600 }}>
              ✨ Nat 20 / 💀 Nat 1 always notify the DM
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Play page: fills the entire viewport below the nav ── */
        .play-grid {
          /* Full width — no centering, no max-width that could exceed viewport */
          width: 100%;
          box-sizing: border-box;
          display: grid;
          /* Chat takes all remaining space; sidebar is a fixed 280px column */
          grid-template-columns: 1fr 280px;
          gap: var(--space-4);
          height: calc(100dvh - 64px);
          padding: var(--space-4) var(--space-4);
          overflow: hidden;
        }

        .play-chat-col {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          min-width: 0;   /* critical: let the flex child shrink below its content size */
          overflow: hidden;
        }

        /* Chat header: title + badge + button — wraps on narrow viewports */
        .play-chat-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-wrap: wrap;
          flex-shrink: 0;
          padding-bottom: var(--space-3);
          border-bottom: 1px solid var(--color-divider);
          min-width: 0;
        }

        .play-title {
          font-family: var(--font-display);
          font-size: var(--text-lg);
          color: var(--color-primary);
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Sidebar: fixed-width column, only scrolls vertically */
        .play-sidebar {
          width: 280px;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          overflow-y: auto;
          overflow-x: hidden;
        }

        /* Tool panel button row: 3 equal buttons that always fit the 280px sidebar */
        .play-sidebar-btns {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-2);
          flex-shrink: 0;
        }
        .play-sidebar-btns .btn {
          /* Override default btn padding so buttons fit in 280px ÷ 3 */
          padding: var(--space-2) var(--space-2);
          justify-content: center;
          font-size: var(--text-xs);
          white-space: nowrap;
          overflow: hidden;
        }

        /* ── Tablet (<= 900px): stack sidebar below chat ── */
        @media (max-width: 900px) {
          .play-grid {
            grid-template-columns: 1fr;
            height: auto;
            overflow: visible;
          }
          .play-chat-col {
            height: clamp(400px, 55dvh, 680px);
            overflow: hidden;
          }
          .play-sidebar {
            width: 100%;
            overflow: visible;
            overflow-x: hidden;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: var(--space-3);
            align-items: start;
          }
          .play-sidebar-btns {
            grid-column: 1 / -1;
          }
          /* Open panel cards span full width */
          .play-sidebar > .card:nth-child(2),
          .play-sidebar > .card:nth-child(3),
          .play-sidebar > .card:nth-child(4) {
            grid-column: 1 / -1;
          }
        }

        /* ── Mobile (<= 540px) ── */
        @media (max-width: 540px) {
          .play-grid {
            padding: var(--space-3);
            gap: var(--space-3);
          }
          .play-chat-col {
            height: clamp(340px, 50dvh, 520px);
          }
          .play-sidebar {
            grid-template-columns: 1fr;
          }
        }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        blockquote {
          border-left: 3px solid var(--color-primary);
          padding-left: var(--space-3);
          color: var(--color-text-muted);
          margin: var(--space-2) 0;
        }
      `}</style>
    </>
  );
}
