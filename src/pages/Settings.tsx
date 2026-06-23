import { useState, useEffect } from 'react';
import { storeApiKey, listVaultEntries, removeApiKey } from '../lib/vault';
import type { LLMProvider } from '../lib/schemas';

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  groq: 'Groq (Free tier)',
  openrouter: 'OpenRouter',
  custom: 'Custom (OpenAI-compatible)',
};

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-opus-4-5',
  google: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openai/gpt-4o',
  custom: 'your-model-name',
};

const PROVIDER_HINTS: Partial<Record<LLMProvider, string>> = {
  groq: 'Free tier. Recommended models: llama-3.3-70b-versatile (best quality), llama-3.1-8b-instant (fastest), mixtral-8x7b-32768 (long context). Get a free key at console.groq.com',
  openrouter: 'Supports many providers via one key. Free models available — prefix with openai/, anthropic/, etc.',
  custom: 'Any OpenAI-compatible endpoint. Enter the base URL below (without /chat/completions).',
};

export default function Settings() {
  const [provider, setProvider] = useState<LLMProvider>('openai');
  const [label, setLabel] = useState('default');
  const [model, setModel] = useState(DEFAULT_MODELS.openai);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [entries, setEntries] = useState(listVaultEntries());
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setModel(DEFAULT_MODELS[provider]);
    setBaseUrl('');
  }, [provider]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (passphrase !== confirmPassphrase) { setStatus({ type: 'error', msg: 'Passphrases do not match.' }); return; }
    if (passphrase.length < 8) { setStatus({ type: 'error', msg: 'Passphrase must be at least 8 characters.' }); return; }
    if (apiKey.length < 20) { setStatus({ type: 'error', msg: 'API key looks too short.' }); return; }
    if (provider === 'custom' && !baseUrl.trim()) { setStatus({ type: 'error', msg: 'Base URL is required for custom provider.' }); return; }
    setSaving(true);
    try {
      await storeApiKey(passphrase, provider, label, model, apiKey, provider === 'custom' ? baseUrl.trim() : undefined);
      setEntries(listVaultEntries());
      setApiKey('');
      setPassphrase('');
      setConfirmPassphrase('');
      setBaseUrl('');
      setStatus({ type: 'success', msg: 'API key encrypted and stored for 6 weeks.' });
    } catch {
      setStatus({ type: 'error', msg: 'Failed to encrypt and store key.' });
    } finally {
      setSaving(false);
    }
  }

  function handleRemove(p: string, l: string) {
    removeApiKey(p, l);
    setEntries(listVaultEntries());
    setStatus({ type: 'success', msg: 'Key removed.' });
  }

  const hint = PROVIDER_HINTS[provider];

  return (
    <div style={{ maxWidth: 'var(--content-narrow)', margin: '0 auto', padding: 'var(--space-12) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>Settings</h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Your API key is encrypted with AES-256-GCM before storage using your passphrase. The raw key never leaves your browser unencrypted.
        </p>
      </div>

      {/* Stored keys */}
      {entries.length > 0 && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>Stored Keys</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {entries.map(e => (
              <div key={`${e.provider}:${e.label}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{PROVIDER_LABELS[e.provider as LLMProvider] ?? e.provider} — {e.model}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Label: {e.label} &bull; Expires: {new Date(e.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}
                  onClick={() => handleRemove(e.provider, e.label)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add key form */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>Add API Key</h2>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          <div>
            <label htmlFor="provider" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>LLM Provider</label>
            <select id="provider" className="input" value={provider} onChange={e => setProvider(e.target.value as LLMProvider)}>
              {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map(p => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
            {hint && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', lineHeight: 1.5 }}>
                {hint}
              </p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label htmlFor="model" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Model</label>
              <input id="model" className="input" value={model} onChange={e => setModel(e.target.value)} placeholder="Model name" />
            </div>
            <div>
              <label htmlFor="label" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Label</label>
              <input id="label" className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="default" />
            </div>
          </div>

          {/* Base URL — only shown for custom provider */}
          {provider === 'custom' && (
            <div>
              <label htmlFor="baseUrl" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Base URL</label>
              <input
                id="baseUrl"
                className="input"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://your-endpoint.com/v1"
                autoComplete="off"
              />
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                Do not include /chat/completions — it is appended automatically.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="apiKey" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>API Key</label>
            <input id="apiKey" type="password" className="input" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..." autoComplete="new-password" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label htmlFor="pass" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Vault Passphrase</label>
              <input id="pass" type="password" className="input" value={passphrase} onChange={e => setPassphrase(e.target.value)}
                placeholder="8+ characters" autoComplete="new-password" />
            </div>
            <div>
              <label htmlFor="confirmPass" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Confirm Passphrase</label>
              <input id="confirmPass" type="password" className="input" value={confirmPassphrase} onChange={e => setConfirmPassphrase(e.target.value)}
                placeholder="Repeat passphrase" autoComplete="new-password" />
            </div>
          </div>

          {status && (
            <p role="alert" style={{ color: status.type === 'success' ? 'var(--color-success)' : 'var(--color-error)', fontSize: 'var(--text-sm)' }}>
              {status.msg}
            </p>
          )}

          <button type="submit" disabled={saving} className="btn btn-primary" style={{ fontSize: 'var(--text-base)', padding: 'var(--space-3) var(--space-8)' }}>
            {saving ? 'Encrypting...' : 'Encrypt & Store Key'}
          </button>
        </form>
      </div>
    </div>
  );
}
