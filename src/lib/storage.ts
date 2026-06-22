/**
 * storage.ts — Typed sessionStorage/localStorage helpers.
 * Uses crypto.randomUUID() (native browser API — no external dependency).
 */

const SESSION_KEY = 'dm_session_v1';
const CAMPAIGN_KEY = 'dm_campaign_v1';
const CHARACTER_KEY = 'dm_character_v1';

export function generateId(): string {
  // Native browser API — no npm package needed
  return crypto.randomUUID();
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ─── Session ─────────────────────────────────────────────────────────────────
export function saveSession(data: unknown): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function loadSession<T>(): T | null {
  return safeParse<T>(sessionStorage.getItem(SESSION_KEY));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Campaign (persisted across tabs) ────────────────────────────────────────
export function saveCampaign(data: unknown): void {
  localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(data));
}

export function loadCampaign<T>(): T | null {
  return safeParse<T>(localStorage.getItem(CAMPAIGN_KEY));
}

export function clearCampaign(): void {
  localStorage.removeItem(CAMPAIGN_KEY);
}

// ─── Character ───────────────────────────────────────────────────────────────
export function saveCharacter(data: unknown): void {
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(data));
}

export function loadCharacter<T>(): T | null {
  return safeParse<T>(localStorage.getItem(CHARACTER_KEY));
}

export function clearCharacter(): void {
  localStorage.removeItem(CHARACTER_KEY);
}
