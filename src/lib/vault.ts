/**
 * Encrypted API Key Vault
 * Uses WebCrypto AES-GCM with PBKDF2 key derivation.
 * Ciphertext is stored in localStorage with a 6-week expiry.
 * The derived CryptoKey lives only in session memory.
 *
 * SECURITY NOTE: This is safer than plaintext localStorage,
 * but a server-side proxy is the recommended long-term approach.
 */

import { ApiKeyEntrySchema, type ApiKeyEntry, type LLMProvider } from './schemas';

const VAULT_KEY = 'dmg_vault_v1';
const SIX_WEEKS_MS = 6 * 7 * 24 * 60 * 60 * 1000;

// ---- Crypto helpers ----

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptString(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  );
  return { ciphertext: bufToB64(encrypted), iv: bufToB64(iv) };
}

async function decryptString(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const dec = new TextDecoder();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBuf(iv) },
    key,
    b64ToBuf(ciphertext),
  );
  return dec.decode(decrypted);
}

// ---- Session-scoped key cache ----
let sessionKey: CryptoKey | null = null;
let sessionSalt: Uint8Array | null = null;

/** Unlock the vault with a user passphrase. Must be called before save/get. */
export async function unlockVault(passphrase: string): Promise<void> {
  sessionSalt = crypto.getRandomValues(new Uint8Array(16));
  sessionKey = await deriveKey(passphrase, sessionSalt);
}

/** Re-derive the key using stored salt (for re-auth on reload). */
export async function relockVault(passphrase: string, saltB64: string): Promise<void> {
  sessionSalt = b64ToBuf(saltB64);
  sessionKey = await deriveKey(passphrase, sessionSalt);
}

export function lockVault(): void {
  sessionKey = null;
  sessionSalt = null;
}

function assertUnlocked(): { key: CryptoKey; salt: Uint8Array } {
  if (!sessionKey || !sessionSalt) throw new Error('Vault is locked. Call unlockVault() first.');
  return { key: sessionKey, salt: sessionSalt };
}

// ---- Vault storage ----

function loadRaw(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRaw(entries: Record<string, unknown>[]): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(entries));
}

/** Save an API key to the encrypted vault. Overwrites same provider+label. */
export async function saveApiKey(
  provider: LLMProvider,
  label: string,
  model: string,
  rawKey: string,
  baseUrl?: string,
): Promise<void> {
  const { key, salt } = assertUnlocked();
  const { ciphertext, iv } = await encryptString(rawKey, key);

  const entry: ApiKeyEntry = ApiKeyEntrySchema.parse({
    provider,
    label,
    model,
    baseUrl,
    encryptedKey: ciphertext,
    iv,
    salt: bufToB64(salt),
    expiresAt: Date.now() + SIX_WEEKS_MS,
  });

  const existing = loadRaw().filter(
    (e) => !(e.provider === provider && e.label === label),
  );
  saveRaw([...existing, entry as unknown as Record<string, unknown>]);
}

/** Retrieve and decrypt an API key. Returns null if not found or expired. */
export async function getApiKey(
  provider: LLMProvider,
  label: string,
): Promise<string | null> {
  const { key } = assertUnlocked();
  const entries = loadRaw();
  const raw = entries.find((e) => e.provider === provider && e.label === label);
  if (!raw) return null;

  const entry = ApiKeyEntrySchema.parse(raw);
  if (Date.now() > entry.expiresAt) {
    removeApiKey(provider, label);
    return null;
  }
  return decryptString(entry.encryptedKey, entry.iv, key);
}

/** List all stored key metadata (never returns the raw key). */
export function listApiKeys(): Omit<ApiKeyEntry, 'encryptedKey' | 'iv' | 'salt'>[] {
  return loadRaw()
    .map((e) => {
      try {
        const parsed = ApiKeyEntrySchema.parse(e);
        const { encryptedKey: _ek, iv: _iv, salt: _s, ...meta } = parsed;
        return meta;
      } catch {
        return null;
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .filter((e) => Date.now() < e.expiresAt);
}

/** Remove a specific key entry. */
export function removeApiKey(provider: LLMProvider, label: string): void {
  const filtered = loadRaw().filter(
    (e) => !(e.provider === provider && e.label === label),
  );
  saveRaw(filtered);
}

/** Purge all expired entries. */
export function pruneExpired(): void {
  const now = Date.now();
  const valid = loadRaw().filter((e) => typeof e.expiresAt === 'number' && (e.expiresAt as number) > now);
  saveRaw(valid);
}
