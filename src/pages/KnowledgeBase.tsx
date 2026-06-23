import { useCallback, useEffect, useRef, useState } from 'react';
import { listVaultEntries, retrieveApiKey } from '../lib/vault';
import {
  ingestDocument,
  listDocuments,
  deleteDocument,
  type KnowledgeDoc,
} from '../lib/knowledge';

function PassphraseModal({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (p: string) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pp-kb-title" style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'oklch(from var(--color-bg) l c h / 0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--space-6)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <div>
          <div id="pp-kb-title" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-1)' }}>Unlock Vault</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Enter your vault passphrase to use your API key for embedding.</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (value.length >= 8) onSubmit(value); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <input ref={inputRef} type="password" className="input"
            placeholder="Vault passphrase" value={value}
            onChange={e => setValue(e.target.value)}
            autoComplete="current-password" aria-label="Vault passphrase" />
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [ppError, setPpError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const passphraseRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const vaultEntries = listVaultEntries();
  const hasKey = vaultEntries.length > 0;

  useEffect(() => {
    listDocuments().then(setDocs).catch(() => {});
  }, []);

  async function processFiles(files: File[], passphrase: string) {
    const entry = vaultEntries[0];
    let apiKey: string | null = null;
    try {
      apiKey = await retrieveApiKey(passphrase, entry.provider, entry.label);
    } catch {
      setPpError('Incorrect passphrase.');
      setShowPassphrase(true);
      return;
    }
    if (!apiKey) { setError('API key expired. Re-add it in Settings.'); return; }

    const baseUrl = (entry as { baseUrl?: string }).baseUrl;

    setError(null);
    for (const file of files) {
      try {
        setProgress(`Processing "${file.name}"…`);
        await ingestDocument(file, apiKey, entry.provider, baseUrl, setProgress);
        const updated = await listDocuments();
        setDocs(updated);
      } catch (e) {
        setError(`Failed to ingest "${file.name}": ${(e as Error).message}`);
      }
    }
    setProgress(null);
  }

  function handleFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfs.length === 0) { setError('Only PDF files are supported.'); return; }
    if (passphraseRef.current) {
      processFiles(pdfs, passphraseRef.current);
    } else {
      setPendingFiles(pdfs);
      setPpError(null);
      setShowPassphrase(true);
    }
  }

  function handlePassphraseSubmit(passphrase: string) {
    passphraseRef.current = passphrase;
    setShowPassphrase(false);
    setPpError(null);
    processFiles(pendingFiles, passphrase);
    setPendingFiles([]);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [passphraseRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(docId: string, docName: string) {
    if (!confirm(`Remove "${docName}" from the knowledge base?`)) return;
    await deleteDocument(docId);
    setDocs(await listDocuments());
  }

  const providerNote = (() => {
    const p = vaultEntries[0]?.provider;
    if (p === 'openai') return null;
    if (p === 'groq') return '⚠ Groq doesn\'t support embeddings — using local trigram similarity instead. Consider switching to an OpenAI key for best retrieval quality.';
    if (p === 'anthropic' || p === 'google') return '⚠ Anthropic/Google don\'t have OpenAI-compatible embedding endpoints — using local trigram similarity. For best results, add an OpenAI key (can be a separate entry).';
    return null;
  })();

  return (
    <>
      {showPassphrase && (
        <PassphraseModal
          onSubmit={handlePassphraseSubmit}
          onCancel={() => { setShowPassphrase(false); setPendingFiles([]); }}
          error={ppError}
        />
      )}

      <div style={{ maxWidth: 'var(--content-default)', margin: '0 auto', padding: 'var(--space-12) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>

        {/* Header */}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>Knowledge Base</h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', maxWidth: '60ch' }}>
            Upload your D&D rulebooks, sourcebooks, and lore PDFs. The DM will automatically
            retrieve relevant passages from these documents and prioritise them over its general training knowledge.
          </p>
        </div>

        {!hasKey && (
          <div role="alert" style={{
            background: 'var(--color-warning-highlight)', border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-sm)', color: 'var(--color-warning)',
          }}>
            ⚠ No API key configured — add one in Settings before uploading documents.
          </div>
        )}

        {providerNote && (
          <div role="alert" style={{
            background: 'var(--color-warning-highlight)', border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-sm)', color: 'var(--color-warning)',
          }}>
            {providerNote}
          </div>
        )}

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => hasKey && !progress && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Drop PDFs here or click to select"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          style={{
            border: `2px dashed ${dragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-16) var(--space-8)',
            textAlign: 'center',
            cursor: hasKey && !progress ? 'pointer' : 'default',
            background: dragging ? 'var(--color-primary-highlight)' : 'var(--color-surface)',
            transition: 'all var(--transition-interactive)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          {progress ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)', fontWeight: 600 }}>{progress}</div>
              <div style={{ width: '200px', height: '4px', background: 'var(--color-surface-offset)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--color-primary)', borderRadius: 'var(--radius-full)', animation: 'kb-progress 1.5s ease-in-out infinite' }} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Drop PDFs here</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>or click to select files &mdash; PHB, DMG, sourcebooks, homebrew, lore docs</div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {error && (
          <div role="alert" style={{
            background: 'var(--color-error-highlight)', border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-sm)', color: 'var(--color-error)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{error}</span>
            <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }} onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* Document list */}
        {docs.length > 0 && (
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-4)' }}>
              Ingested Documents ({docs.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {docs.map(doc => (
                <div key={doc.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {doc.chunkCount} chunks &bull; {formatBytes(doc.size)} &bull; Added {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', flexShrink: 0 }}
                    onClick={() => handleDelete(doc.id, doc.name)}
                    aria-label={`Remove ${doc.name}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {docs.length === 0 && !progress && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', padding: 'var(--space-4)' }}>
            No documents ingested yet. Drop your PDFs above to get started.
          </div>
        )}

        {/* How it works */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>How it works</div>
          <ol style={{ paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', listStyle: 'decimal' }}>
            <li>Your PDFs are parsed and split into overlapping text chunks (≈500 tokens each).</li>
            <li>Each chunk is converted into a vector embedding via your API key and stored locally in your browser's IndexedDB — nothing leaves your device except the embedding API call.</li>
            <li>When you send a message to the DM, the most relevant chunks are retrieved via cosine similarity and injected into the system prompt as a <strong>Rules &amp; Lore Reference</strong> section.</li>
            <li>The DM is instructed to treat your documents as authoritative and prioritise them over general training knowledge.</li>
          </ol>
        </div>
      </div>

      <style>{`
        @keyframes kb-progress {
          0% { width: 0%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </>
  );
}
