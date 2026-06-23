import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import DiceRoller from '../components/DiceRoller';
import CombatTracker from '../components/CombatTracker';
import { getActiveCampaignId, loadCampaign, appendEvent } from '../lib/storage';
import { listVaultEntries } from '../lib/vault';
import { sendToDM } from '../lib/dm';
import type { DiceRollResult } from '../lib/schemas';

// 'event' is a local-only role for dice rolls and game events.
// These messages are displayed in the UI but stripped by llm.ts before
// any API call, so they never pollute the LLM conversation history.
interface Message {
  role: 'user' | 'assistant' | 'event';
  content: string;
  timestamp: string;
}

const RULES_LABELS: Record<number, string> = {
  1: 'By the Book',
  2: 'Mostly RAW',
  3: 'Balanced',
  4: 'Flexible',
  5: 'Rule of Cool',
};

const NARRATIVE_LABELS: Record<number, string> = {
  1: 'Pure Narrative',
  2: 'Story-first',
  3: 'Balanced',
  4: 'Dice-leaning',
  5: 'Dice Heavy',
};

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
          <input
            ref={inputRef}
            type="password"
            className="input"
            placeholder="Vault passphrase"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoComplete="current-password"
            aria-label="Vault passphrase"
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

export default function Play() {
  const navigate = useNavigate();
  const campaignId = getActiveCampaignId();
  const campaign = campaignId ? loadCampaign(campaignId) : null;

  const [messages, setMessages] = useState<Message[]>(
    campaign?.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp }))
    ?? []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [panel, setPanel] = useState<'dice' | 'combat' | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [pendingInput, setPendingInput] = useState('');
  const [dmError, setDmError] = useState<string | null>(null);
  const passphraseRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const vaultEntries = listVaultEntries();
  const hasKey = vaultEntries.length > 0;

  const rulesLabel = useMemo(() => RULES_LABELS[campaign?.options.rulesStrictness ?? 3], [campaign?.options.rulesStrictness]);
  const narrativeLabel = useMemo(() => NARRATIVE_LABELS[campaign?.options.narrativeStyle ?? 3], [campaign?.options.narrativeStyle]);

  if (!campaign) {
    return (
      <div style={{
        maxWidth: 'var(--content-narrow)', margin: '0 auto',
        padding: 'var(--space-16) var(--space-6)', textAlign: 'center',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center'
      }}>
        <div style={{ fontSize: '3rem' }}>🏰</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--color-primary)' }}>No Active Campaign</h1>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '36ch' }}>Configure your adventure first, then return here to play.</p>
        <button className="btn btn-primary" onClick={() => navigate('/setup')}>Begin an Adventure &rarr;</button>
      </div>
    );
  }

  async function doSend(text: string, passphrase: string) {
    if (!text.trim() || loading) return;
    setLoading(true);
    setDmError(null);
    setStreamingText('');
    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    abortRef.current = new AbortController();
    await sendToDM(
      text.trim(),
      passphrase,
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
    );
  }

  function handleSend() {
    if (!input.trim() || loading || !hasKey) return;
    const text = input.trim();
    setInput('');
    if (passphraseRef.current) { doSend(text, passphraseRef.current); return; }
    setPendingInput(text);
    setPassphraseError(null);
    setShowPassphrase(true);
  }

  function handleOpenScene() {
    if (loading || !hasKey) return;
    if (passphraseRef.current) {
      doSend('__OPEN_SCENE__', passphraseRef.current);
      return;
    }
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
    // role: 'event' — displayed locally, never sent to the LLM API
    setMessages(m => [...m, {
      role: 'event',
      content: `🎲 **${result.actorType === 'player' ? 'You rolled' : 'Rolled'}** ${result.notation}: **${result.total}** [${result.rolls.join(', ')}]${result.reason ? ` — *${result.reason}*` : ''}`,
      timestamp: result.timestamp,
    }]);
  }

  return (
    <>
      {showPassphrase && (
        <PassphraseModal
          onSubmit={handlePassphraseSubmit}
          onCancel={() => { setShowPassphrase(false); setPendingInput(''); }}
          error={passphraseError}
        />
      )}

      <div style={{
        maxWidth: 'var(--content-wide)', margin: '0 auto', padding: 'var(--space-6)',
        display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-6)',
        height: 'calc(100dvh - 64px)', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-divider)', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--color-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {campaign.title}
            </h1>
            <span className="badge">{campaign.options.mode === 'one_shot' ? 'One-shot' : 'Campaign'}</span>
            <button className="btn btn-gold" onClick={handleOpenScene} disabled={!hasKey || loading}>Open Scene</button>
          </div>

          {!hasKey && (
            <div role="alert" style={{
              background: 'var(--color-warning-highlight)', border: '1px solid var(--color-warning)',
              borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--text-sm)', color: 'var(--color-warning)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)',
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
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{dmError}</span>
              <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)' }} onClick={() => setDmError(null)}>×</button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingRight: 'var(--space-2)' }}>
            {messages.length === 0 && !streamingText && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-16) var(--space-8)' }}>
                <div style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Your adventure awaits</div>
                <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>Type a message or open the first scene to begin.</p>
                <button className="btn btn-primary" onClick={handleOpenScene} disabled={!hasKey || loading}>Start with the opening scene</button>
              </div>
            )}

            {messages.map((m, i) => {
              // Event messages (dice rolls) get a distinct centered pill style,
              // visually separate from user/assistant bubbles.
              if (m.role === 'event') {
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--color-surface-offset)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
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
                <div
                  style={{
                    maxWidth: '80%', padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    fontSize: 'var(--text-sm)', wordBreak: 'break-word', lineHeight: 1.6,
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

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={hasKey ? 'What do you do? (Enter to send, Shift+Enter for newline)' : 'Add an API key in Settings to start playing...'}
              className="input" rows={2} style={{ flex: 1, resize: 'none' }}
              aria-label="Message to the DM"
              disabled={!hasKey || loading}
            />
            <button onClick={handleSend} disabled={loading || !input.trim() || !hasKey} className="btn btn-primary" aria-label="Send message">
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className={`btn ${panel === 'dice' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setPanel(p => p === 'dice' ? null : 'dice')}>Dice</button>
            <button className={`btn ${panel === 'combat' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setPanel(p => p === 'combat' ? null : 'combat')}>Combat</button>
          </div>

          {panel === 'dice' && (
            <div className="card"><DiceRoller onRoll={handleDiceRoll} actorType="player" /></div>
          )}

          {panel === 'combat' && (
            <div className="card"><CombatTracker /></div>
          )}

          {campaign.characters.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Party</div>
              {campaign.characters.map(c => (
                <div key={c.id} style={{ fontSize: 'var(--text-xs)', display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                  <span>{c.characterName}</span><span>{c.class} {c.level}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>Campaign</div>
            <div>Mode: {campaign.options.mode === 'one_shot' ? 'One-shot' : 'Campaign'}</div>
            <div>Tone: {campaign.options.tone.join(', ')}</div>
            <div>Experience: {campaign.options.experienceLevel}</div>
            <div>Rules: {rulesLabel}</div>
            <div>Narrative: {narrativeLabel}</div>
            <div>Safety: {campaign.options.safetyMode}</div>
            <button className="btn btn-ghost" style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-1) var(--space-2)' }} onClick={() => navigate('/setup')}>New Adventure</button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        blockquote { border-left: 3px solid var(--color-primary); padding-left: var(--space-3); color: var(--color-text-muted); margin: var(--space-2) 0; }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 1fr 320px"] { grid-template-columns: 1fr !important; height: auto !important; }
        }
      `}</style>
    </>
  );
}
