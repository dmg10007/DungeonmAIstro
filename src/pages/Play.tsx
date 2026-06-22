import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DiceRoller from '../components/DiceRoller';
import { getActiveCampaignId, loadCampaign, saveCampaign, appendEvent } from '../lib/storage';
import { listVaultEntries } from '../lib/vault';
import type { DiceRollResult } from '../lib/schemas';

interface Message { role: 'user' | 'assistant'; content: string; timestamp: string; }

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
  const [panel, setPanel] = useState<'dice' | 'combat' | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const vaultEntries = listVaultEntries();
  const hasKey = vaultEntries.length > 0;

  // ── No active campaign ──────────────────────────────────────────────────────
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

  async function sendMessage() {
    if (!input.trim() || loading) return;
    if (!hasKey) {
      alert('Add an LLM API key in Settings before sending messages.');
      return;
    }

    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const entry = vaultEntries[0];
      // TODO Phase 2: replace with real LLM orchestrator (dm.ts)
      const placeholder: Message = {
        role: 'assistant',
        content: `*The DM considers your words...*\n\nLLM integration is coming next. Your message has been logged.\n\n**Campaign:** ${campaign.title}\n**Provider:** ${entry.provider} — ${entry.model}\n**Party:** ${campaign.characters.length > 0 ? campaign.characters.map(c => `${c.characterName} (${c.class} ${c.level})`).join(', ') : 'No characters added yet'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(m => [...m, placeholder]);

      const updated = loadCampaign(campaignId!);
      if (updated) {
        updated.messages.push(
          { role: 'user', content: userMsg.content, timestamp: userMsg.timestamp },
          { role: 'assistant', content: placeholder.content, timestamp: placeholder.timestamp }
        );
        saveCampaign(updated);
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'An error occurred. Please try again.', timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }

  function handleDiceRoll(result: DiceRollResult) {
    if (!campaignId) return;
    appendEvent(campaignId, { type: 'dice_rolled', timestamp: result.timestamp, result });
    setMessages(m => [...m, {
      role: 'assistant',
      content: `🎲 **${result.actorType === 'player' ? 'You rolled' : 'Rolled'}** ${result.notation}: **${result.total}** [${result.rolls.join(', ')}]${result.reason ? ` — *${result.reason}*` : ''}`,
      timestamp: result.timestamp,
    }]);
  }

  return (
    <div style={{
      maxWidth: 'var(--content-wide)', margin: '0 auto', padding: 'var(--space-6)',
      display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-6)',
      height: 'calc(100dvh - 64px)', boxSizing: 'border-box'
    }}>

      {/* ── Chat pane ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-divider)', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--color-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {campaign.title}
          </h1>
          <span className="badge">{campaign.options.mode === 'one_shot' ? 'One-shot' : 'Campaign'}</span>
        </div>

        {/* No API key banner */}
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

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingRight: 'var(--space-2)' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-16) var(--space-8)' }}>
              <div style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Your adventure awaits</div>
              <p style={{ fontSize: 'var(--text-sm)' }}>Type a message to begin. The Dungeon Master is ready.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 'var(--space-1)',
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>
                {m.role === 'user' ? 'You' : '🏰 DM'}
              </div>
              <div style={{
                maxWidth: '80%',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                background: m.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: m.role === 'user' ? 'var(--color-text-inverse)' : 'var(--color-text)',
                border: m.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                fontSize: 'var(--text-sm)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)'
              }}>The DM is thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={hasKey ? 'What do you do? (Enter to send, Shift+Enter for newline)' : 'Add an API key in Settings to start playing...'}
            className="input"
            rows={2}
            style={{ flex: 1, resize: 'none' }}
            aria-label="Message to the DM"
            disabled={!hasKey}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || !hasKey}
            className="btn btn-primary"
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className={`btn ${panel === 'dice' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}
            onClick={() => setPanel(p => p === 'dice' ? null : 'dice')}>Dice</button>
          <button className={`btn ${panel === 'combat' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }}
            onClick={() => setPanel(p => p === 'combat' ? null : 'combat')}>Combat</button>
        </div>

        {panel === 'dice' && (
          <div className="card">
            <DiceRoller onRoll={handleDiceRoll} actorType="player" />
          </div>
        )}

        {panel === 'combat' && (
          <div className="card" style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-lg)' }}>⚔️</div>
            <div style={{ fontSize: 'var(--text-sm)' }}>Combat tracker — coming in Phase 2.</div>
          </div>
        )}

        {/* Party summary */}
        {campaign.characters.length > 0 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Party</div>
            {campaign.characters.map(c => (
              <div key={c.id} style={{ fontSize: 'var(--text-xs)', display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                <span>{c.characterName}</span>
                <span>{c.class} {c.level}</span>
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
          <div>Safety: {campaign.options.safetyMode}</div>
          <button
            className="btn btn-ghost"
            style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-1) var(--space-2)' }}
            onClick={() => navigate('/setup')}
          >New Adventure</button>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 1fr 320px"] {
            grid-template-columns: 1fr !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
