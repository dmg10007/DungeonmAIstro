/**
 * vault.ts — Encrypted API key vault using WebCrypto AES-GCM
 *
 * Security model:
 * - User provides a passphrase on setup
 * - Key material derived with PBKDF2 (310,000 iterations, SHA-256)
 * - Ciphertext + IV + salt stored in localStorage
 * - Raw key NEVER written to storage; only exists in session memory
 * - Keys expire after 6 weeks (enforced on read)
 */

const VAULT_KEY = 'dm_vault_v1';
const KEY_EXPIRY_MS = 6 * 7 * 24 * 60 * 60 * 1000; // 6 weeks

interface VaultEntry {
  ciphertext: string;   // base64 AES-GCM ciphertext
  iv: string;           // base64 IV
  salt: string;         // base64 PBKDF2 salt
  storedAt: number;     // Unix ms timestamp
  expiresAt: number;    // Unix ms timestamp
  provider: string;
  label: string;
  model: string;
}

/** Derive AES-GCM key from passphrase + salt using PBKDF2 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

/** Store an API key encrypted with the user's passphrase */
export async function storeApiKey(
  passphrase: string,
  provider: string,
  label: string,
  model: string,
  apiKey: string
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await deriveKey(passphrase, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    enc.encode(apiKey)
  );
  const now = Date.now();
  const entry: VaultEntry = {
    ciphertext: b64(ciphertext),
    iv: b64(iv),
    salt: b64(salt),
    storedAt: now,
    expiresAt: now + KEY_EXPIRY_MS,
    provider,
    label,
    model,
  };
  // Merge with existing vault
  const existing = loadVaultRaw();
  existing[`${provider}:${label}`] = entry;
  localStorage.setItem(VAULT_KEY, JSON.stringify(existing));
}

/** Retrieve and decrypt an API key */
export async function retrieveApiKey(
  passphrase: string,
  provider: string,
  label: string
): Promise<string | null> {
  const existing = loadVaultRaw();
  const entry: VaultEntry | undefined = existing[`${provider}:${label}`];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    removeApiKey(provider, label);
    return null;
  }
  try {
    const cryptoKey = await deriveKey(passphrase, unb64(entry.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(entry.iv) },
      cryptoKey,
      unb64(entry.ciphertext)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null; // wrong passphrase or corrupted
  }
}

/** List stored key metadata (no plaintext keys exposed) */
export function listVaultEntries(): Omit<VaultEntry, 'ciphertext' | 'iv' | 'salt'>[] {
  const raw = loadVaultRaw();
  return Object.values(raw).map(({ ciphertext: _c, iv: _i, salt: _s, ...meta }) => meta);
}

/** Remove a key entry */
export function removeApiKey(provider: string, label: string): void {
  const existing = loadVaultRaw();
  delete existing[`${provider}:${label}`];
  localStorage.setItem(VAULT_KEY, JSON.stringify(existing));
}

/** Purge all expired keys */
export function purgeExpiredKeys(): void {
  const existing = loadVaultRaw();
  const now = Date.now();
  let changed = false;
  for (const k of Object.keys(existing)) {
    if (existing[k].expiresAt < now) { delete existing[k]; changed = true; }
  }
  if (changed) localStorage.setItem(VAULT_KEY, JSON.stringify(existing));
}

function loadVaultRaw(): Record<string, VaultEntry> {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, VaultEntry>;
  } catch { return {}; }
}
