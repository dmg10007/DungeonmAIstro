/**
 * knowledge.ts — Client-side RAG knowledge base
 *
 * Pipeline:
 *   PDF → pdf.js text extraction → chunk (≈500 tokens, 100 token overlap)
 *   → embeddings API (OpenAI-compatible) → Float32 vectors → IndexedDB
 *
 * Retrieval:
 *   embed query → cosine similarity against all stored chunks
 *   → return top-k chunks as a ## Rules Reference block for the system prompt
 *
 * Security:
 *   - Vectors + text stored in IndexedDB (no size limit vs localStorage)
 *   - API key for embeddings reuses the vault passphrase flow via the caller
 *   - No chunk text is ever sent anywhere except the embeddings endpoint and
 *     back into the local system prompt context window
 */

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
export interface KnowledgeChunk {
  id: string;          // uuid
  docId: string;       // parent document id
  docName: string;     // human-readable file name
  text: string;        // raw chunk text
  embedding: number[]; // float32 vector
  createdAt: string;   // ISO timestamp
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  size: number;        // bytes
  chunkCount: number;
  createdAt: string;
}

// ----------------------------------------------------------------
// IndexedDB helpers
// ----------------------------------------------------------------
const DB_NAME = 'dm_knowledge_v1';
const STORE_CHUNKS = 'chunks';
const STORE_DOCS = 'docs';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const cs = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id' });
        cs.createIndex('docId', 'docId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbDeleteByIndex(
  db: IDBDatabase,
  store: string,
  indexName: string,
  value: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const idx = tx.objectStore(store).index(indexName);
    const req = idx.openCursor(IDBKeyRange.only(value));
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ----------------------------------------------------------------
// Text chunking
// ----------------------------------------------------------------
const CHUNK_SIZE = 500;   // approximate tokens (chars / 4)
const CHUNK_OVERLAP = 100;
const CHARS_PER_TOKEN = 4;

function chunkText(text: string, docId: string, docName: string): Omit<KnowledgeChunk, 'embedding'>[] {
  // Normalise whitespace
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
  const chunkChars = CHUNK_SIZE * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP * CHARS_PER_TOKEN;

  const chunks: Omit<KnowledgeChunk, 'embedding'>[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + chunkChars, clean.length);
    const slice = clean.slice(start, end);
    if (slice.trim().length > 40) {
      chunks.push({
        id: crypto.randomUUID(),
        docId,
        docName,
        text: slice,
        createdAt: new Date().toISOString(),
      });
    }
    if (end >= clean.length) break;
    start = end - overlapChars;
  }
  return chunks;
}

// ----------------------------------------------------------------
// PDF text extraction via pdf.js (loaded from CDN)
// ----------------------------------------------------------------
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfjsLib: any;
  }
}

async function loadPdfJs(): Promise<void> {
  if (window.pdfjsLib) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
    s.type = 'module';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load pdf.js'));
    document.head.appendChild(s);
  });
  // Allow module to initialise
  await new Promise(r => setTimeout(r, 300));
}

export async function extractTextFromPDF(file: File): Promise<string> {
  await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((item: any) => item.str).join(' ');
    pages.push(pageText);
  }
  return pages.join('\n');
}

// ----------------------------------------------------------------
// Embeddings — OpenAI-compatible endpoint
// ----------------------------------------------------------------
async function fetchEmbeddings(
  texts: string[],
  apiKey: string,
  provider: string,
  baseUrl?: string,
): Promise<number[][]> {
  // Determine endpoint
  let url: string;
  if (provider === 'openai') {
    url = 'https://api.openai.com/v1/embeddings';
  } else if (provider === 'groq') {
    // Groq does not currently support embeddings — fall back to a simple
    // TF-IDF-style pseudo-embedding using character n-gram hashing so the
    // UI doesn't break. Retrieval quality will be lower but functional.
    return texts.map(t => pseudoEmbed(t));
  } else if (provider === 'custom' && baseUrl) {
    url = `${baseUrl.replace(/\/$/, '')}/embeddings`;
  } else if (provider === 'openrouter') {
    url = 'https://openrouter.ai/api/v1/embeddings';
  } else {
    // Anthropic / Google don't have OpenAI-compatible embedding endpoints
    // — fall back to pseudo-embeddings
    return texts.map(t => pseudoEmbed(t));
  }

  const BATCH = 20;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: batch,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embeddings API error ${res.status}: ${err}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json() as { data: { embedding: number[] }[] };
    all.push(...json.data.map(d => d.embedding));
  }
  return all;
}

/**
 * Pseudo-embedding for providers that don't support embeddings.
 * Uses a 256-dim character trigram frequency vector — not as accurate
 * as real embeddings but enables approximate retrieval.
 */
function pseudoEmbed(text: string): number[] {
  const dim = 256;
  const vec = new Float32Array(dim);
  const t = text.toLowerCase();
  for (let i = 0; i < t.length - 2; i++) {
    const h = (t.charCodeAt(i) * 31 + t.charCodeAt(i + 1) * 37 + t.charCodeAt(i + 2) * 41) % dim;
    vec[h] += 1;
  }
  // L2 normalise
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec).map(v => v / norm);
}

// ----------------------------------------------------------------
// Cosine similarity
// ----------------------------------------------------------------
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/** Ingest a PDF file into the knowledge base */
export async function ingestDocument(
  file: File,
  apiKey: string,
  provider: string,
  baseUrl: string | undefined,
  onProgress: (msg: string) => void,
): Promise<KnowledgeDoc> {
  onProgress('Extracting text from PDF…');
  const text = await extractTextFromPDF(file);
  if (text.trim().length < 50) throw new Error('Could not extract readable text from this PDF.');

  const docId = crypto.randomUUID();
  const docName = file.name;

  onProgress('Splitting into chunks…');
  const rawChunks = chunkText(text, docId, docName);
  if (rawChunks.length === 0) throw new Error('No usable text found in PDF.');

  onProgress(`Embedding ${rawChunks.length} chunks (this may take a minute)…`);
  const embeddings = await fetchEmbeddings(
    rawChunks.map(c => c.text),
    apiKey,
    provider,
    baseUrl,
  );

  const chunks: KnowledgeChunk[] = rawChunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i],
  }));

  onProgress('Storing in IndexedDB…');
  const db = await openDB();
  for (const chunk of chunks) {
    await idbPut(db, STORE_CHUNKS, chunk);
  }

  const doc: KnowledgeDoc = {
    id: docId,
    name: docName,
    size: file.size,
    chunkCount: chunks.length,
    createdAt: new Date().toISOString(),
  };
  await idbPut(db, STORE_DOCS, doc);
  db.close();

  onProgress('Done!');
  return doc;
}

/** List all ingested documents */
export async function listDocuments(): Promise<KnowledgeDoc[]> {
  const db = await openDB();
  const docs = await idbGetAll<KnowledgeDoc>(db, STORE_DOCS);
  db.close();
  return docs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Remove a document and all its chunks */
export async function deleteDocument(docId: string): Promise<void> {
  const db = await openDB();
  await idbDeleteByIndex(db, STORE_CHUNKS, 'docId', docId);
  await idbDelete(db, STORE_DOCS, docId);
  db.close();
}

/**
 * Retrieve the top-k most relevant chunks for a query.
 * Returns a formatted markdown string ready to inject into the system prompt,
 * or an empty string if the knowledge base is empty.
 */
export async function retrieveContext(
  query: string,
  apiKey: string,
  provider: string,
  baseUrl: string | undefined,
  topK = 5,
): Promise<string> {
  const db = await openDB();
  const chunks = await idbGetAll<KnowledgeChunk>(db, STORE_CHUNKS);
  db.close();

  if (chunks.length === 0) return '';

  const [queryEmb] = await fetchEmbeddings([query], apiKey, provider, baseUrl);
  const scored = chunks
    .map(c => ({ chunk: c, score: cosineSimilarity(queryEmb, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(s => s.score > 0.15); // ignore very low-similarity results

  if (scored.length === 0) return '';

  const sections = scored.map(s =>
    `[Source: ${s.chunk.docName}]\n${s.chunk.text.trim()}`
  ).join('\n\n---\n\n');

  return [
    '## Rules & Lore Reference',
    'The following excerpts are retrieved from the DM\'s uploaded rulebooks and lore documents.',
    'Treat these as authoritative — prioritise this content over your general training knowledge when they conflict.',
    '',
    sections,
  ].join('\n');
}

/** Quick check: is the knowledge base populated? */
export async function hasKnowledge(): Promise<boolean> {
  const db = await openDB();
  const docs = await idbGetAll<KnowledgeDoc>(db, STORE_DOCS);
  db.close();
  return docs.length > 0;
}
