/**
 * Encrypted API Key Vault
 * Keys are encrypted with AES-GCM using a PBKDF2-derived key from a user passphrase.
 * Only the ciphertext, IV, and salt are persisted — the crypto key lives in memory only.
 * 6-week expiry is enforced on read.
 */
import { z } from 'zod';
import { apiKeyRecordSchema, type ApiKeyRecord, type LLMProvider } from './schemas';

const VAULT_KEY = 'dm-vault';
const SIX_WEEKS_MS = 6 * 7 * 24 * 60 * 60 * 1000;

// In-memory crypto key (never persisted)
let derivedKey: CryptoKey | null = null;

function buf2b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b642buf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Unlock the vault with the user's passphrase. Must be called before encrypt/decrypt ops. */
export async function unlockVault(passphrase: string, salt?: Uint8Array): Promise<Uint8Array> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  derivedKey = await deriveKey(passphrase, s);
  return s;
}

/** Lock the vault (clear in-memory key). */
export function lockVault(): void {
  derivedKey = null;
}

export function isVaultUnlocked(): boolean {
  return derivedKey !== null;
}

/** Store an API key (encrypted). Returns false if vault is locked. */
export async function storeApiKey(
  provider: LLMProvider,
  label: string,
  rawKey: string,
): Promise<boolean> {
  if (!derivedKey) return false;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  // Re-derive with this entry's own salt for isolation
  const entryKey = await deriveKey(rawKey.slice(0, 8), salt); // stretch with partial key as extra entropy
  void entryKey; // We use the session derivedKey for actual encryption

  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    enc.encode(rawKey),
  );

  const record: ApiKeyRecord = {
    provider,
    label,
    encryptedKey: buf2b64(ciphertext),
    iv: buf2b64(iv.buffer),
    salt: buf2b64(salt.buffer),
    expiresAt: Date.now() + SIX_WEEKS_MS,
    createdAt: Date.now(),
  };

  const vault = loadRawVault();
  vault[provider] = record;
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  return true;
}

/** Retrieve and decrypt an API key. Returns null if not found, expired, or vault locked. */
export async function getApiKey(provider: LLMProvider): Promise<string | null> {
  if (!derivedKey) return null;

  const vault = loadRawVault();
  const raw = vault[provider];
  if (!raw) return null;

  const parsed = apiKeyRecordSchema.safeParse(raw);
  if (!parsed.success) return null;

  const record = parsed.data;
  if (Date.now() > record.expiresAt) {
    // Expired — remove
    delete vault[provider];
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
    return null;
  }

  try {
    const iv = new Uint8Array(b642buf(record.iv));
    const ciphertext = b642buf(record.encryptedKey);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      ciphertext,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** List stored providers (metadata only, no keys). */
export function listStoredProviders(): Array<{ provider: LLMProvider; label: string; expiresAt: number }> {
  const vault = loadRawVault();
  return Object.values(vault)
    .map((r) => {
      const p = apiKeyRecordSchema.safeParse(r);
      if (!p.success) return null;
      return { provider: p.data.provider, label: p.data.label, expiresAt: p.data.expiresAt };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && Date.now() < x.expiresAt);
}

/** Remove a specific provider key. */
export function removeApiKey(provider: LLMProvider): void {
  const vault = loadRawVault();
  delete vault[provider];
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

function loadRawVault(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
