import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DiceRoller from '../components/DiceRoller';
import { getActiveCampaignId, loadCampaign, saveCampaign, appendEvent } from '../lib/storage';
import { listVaultEntries } from '../lib/vault';
import type { DiceRollResult } from '../lib/schemas';

interface Message { role: 'user' | 'assistant'; content: string; timestamp: string; }

export default function Play() {
  const navigate = useNavigate();
  const campaignId = getActiveCampaignId();
  const campaign = campaignId ? loadCampaign(campaignId) : null;
  const [messages, setMessages] = useState<Message[]>(campaign?.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp })) ?? []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<'dice' | 'combat' | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const vaultEntries = listVaultEntries();
  const hasKey = vaultEntries.length > 0;

  if (!campaign) {
    return (
      <div style={{ maxWidth: 'var(--content-narrow)', margin: '0 auto', padding: 'var(--space-12) var(--space-6)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--color-primary)' }}>No Active Campaign</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Start a new adventure to begin playing.</p>
        <button className="btn btn-primary" onClick={() => navigate('/setup')}>Begin an Adventure</button>
      </div>
    );
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    if (!hasKey) { alert('Add an LLM API key in Settings first.'); return; }

    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const entry = vaultEntries[0];
      // Placeholder: real DM orchestration will call the user's LLM provider here
      const placeholder: Message = {
        role: 'assistant',
        content: `*The DM considers your words...*\n\nLLM integration is coming in the next milestone. Your message has been logged.\n\n**Campaign:** ${campaign.title}\n**Provider configured:** ${entry.provider} (${entry.label})`,
        timestamp: new Date().toISOString(),
      };
      setMessages(m => [...m, placeholder]);

      // Persist messages to campaign
      const updated = loadCampaign(campaignId!);
      if (updated) {
        updated.messages.push(
          { role: 'user', content: userMsg.content, timestamp: userMsg.timestamp },
          { role: 'assistant', content: placeholder.content, timestamp: placeholder.timestamp }
        );
        saveCampaign(updated);
      }
    } catch (err) {
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
    <div style={{ maxWidth: 'var(--content-wide)', margin: '0 auto', padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--space-6)', height: 'calc(100dvh - 64px)', boxSizing: 'border-box' }}>

      {/* Chat pane */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-divider)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--color-primary)', flex: 1 }}>{campaign.title}</h1>
          <span className="badge">{campaign.options.mode === 'one_shot' ? 'One-shot' : 'Campaign'}</span>
        </div>

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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>The DM is thinking...</div>
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
            placeholder="What do you do? (Enter to send, Shift+Enter for newline)"
            className="input"
            rows={2}
            style={{ flex: 1, resize: 'none' }}
            aria-label="Message to the DM"
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn btn-primary" aria-label="Send message">
            Send
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className={`btn ${panel === 'dice' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setPanel(p => p === 'dice' ? null : 'dice')}>Dice</button>
          <button className={`btn ${panel === 'combat' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setPanel(p => p === 'combat' ? null : 'combat')}>Combat</button>
        </div>

        {panel === 'dice' && (
          <div className="card">
            <DiceRoller onRoll={handleDiceRoll} actorType="player" />
          </div>
        )}

        {panel === 'combat' && (
          <div className="card" style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ marginBottom: 'var(--space-2)' }}>⚔️</div>
            <div style={{ fontSize: 'var(--text-sm)' }}>Combat tracker coming in next milestone.</div>
          </div>
        )}

        {/* Characters summary */}
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
      </div>

      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 1fr 320px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
