/**
 * storage.ts — Typed localStorage/sessionStorage helpers.
 * All IDs use crypto.randomUUID() — no external dependency.
 */

import type { Character } from '../types';
import type { AdventureOptions, DiceRollResult } from './schemas';

// ─── ID generation ────────────────────────────────────────────────────────────────────────────
export function generateId(): string { return crypto.randomUUID(); }
/** Alias used by CharacterLab */
export const newId = generateId;

// ─── Storage keys ───────────────────────────────────────────────────────────────────────
const CAMPAIGNS_KEY    = 'dm_campaigns_v1';
const ACTIVE_KEY       = 'dm_active_campaign';
const CHARACTER_KEY    = 'dm_character_v1';
const SESSION_KEY      = 'dm_session_v1';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ─── Campaign shape used throughout the app ────────────────────────────────────────────────────
export interface StoredCampaign {
  id: string;
  title: string;
  options: AdventureOptions;
  /** mode mirrors options.mode for quick access */
  mode: string;
  // 'event' messages are display-only (dice rolls, game events).
  // dm.ts filters them out before persisting and before sending to the LLM.
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'event'; content: string; timestamp: string }>;
  characters: StoredCharacterRef[];
  events: CampaignEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredCharacterRef {
  id: string;
  characterName: string;
  class: string;
  level: number;
}

export interface CampaignEvent {
  type: string;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ─── Campaign list (summaries) ────────────────────────────────────────────────────────────────
export interface CampaignSummary {
  id: string;
  title: string;
  mode: string;
  updatedAt: string;
}

function loadSummaries(): CampaignSummary[] {
  return safeParse<CampaignSummary[]>(localStorage.getItem(CAMPAIGNS_KEY)) ?? [];
}

function saveSummaries(list: CampaignSummary[]): void {
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));
}

export function listCampaigns(): CampaignSummary[] {
  return loadSummaries().sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// ─── Active campaign pointer ──────────────────────────────────────────────────────────────
export function getActiveCampaignId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}
export function setActiveCampaignId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}
export function clearActiveCampaign(): void {
  localStorage.removeItem(ACTIVE_KEY);
}

// ─── Full campaign CRUD ────────────────────────────────────────────────────────────────────────
export function createCampaign(
  title: string,
  options: AdventureOptions,
  characters: StoredCharacterRef[] = []
): string {
  const id = generateId();
  const now = new Date().toISOString();
  const campaign: StoredCampaign = {
    id,
    title: title.trim() || `Adventure — ${new Date().toLocaleDateString()}`,
    options,
    mode: options.mode,
    messages: [],
    characters,
    events: [],
    createdAt: now,
    updatedAt: now,
  };
  localStorage.setItem(`dm_campaign_${id}`, JSON.stringify(campaign));
  const summaries = loadSummaries();
  summaries.unshift({ id, title: campaign.title, mode: campaign.mode, updatedAt: now });
  saveSummaries(summaries);
  setActiveCampaignId(id);
  return id;
}

export function loadCampaign(id: string): StoredCampaign | null {
  return safeParse<StoredCampaign>(localStorage.getItem(`dm_campaign_${id}`));
}

export function saveCampaign(campaign: StoredCampaign): void {
  campaign.updatedAt = new Date().toISOString();
  localStorage.setItem(`dm_campaign_${campaign.id}`, JSON.stringify(campaign));
  const summaries = loadSummaries().filter(s => s.id !== campaign.id);
  summaries.unshift({ id: campaign.id, title: campaign.title, mode: campaign.mode, updatedAt: campaign.updatedAt });
  saveSummaries(summaries);
}

export function deleteCampaign(id: string): void {
  localStorage.removeItem(`dm_campaign_${id}`);
  saveSummaries(loadSummaries().filter(s => s.id !== id));
  if (getActiveCampaignId() === id) clearActiveCampaign();
}

/** Append a structured event (dice roll, combat, etc.) to a campaign's event log */
export function appendEvent(campaignId: string, event: CampaignEvent): void {
  const campaign = loadCampaign(campaignId);
  if (!campaign) return;
  campaign.events.push(event);
  saveCampaign(campaign);
}

// ─── Character ────────────────────────────────────────────────────────────────────────────
export function saveCharacter(data: Character): void {
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(data));
}
export function loadCharacter(): Character | null {
  return safeParse<Character>(localStorage.getItem(CHARACTER_KEY));
}
export function clearCharacter(): void {
  localStorage.removeItem(CHARACTER_KEY);
}

// ─── Session (tab-scoped) ──────────────────────────────────────────────────────────────────────
export function saveSession(data: unknown): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
export function loadSession<T>(): T | null {
  return safeParse<T>(sessionStorage.getItem(SESSION_KEY));
}
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
