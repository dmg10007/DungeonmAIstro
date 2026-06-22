/**
 * storage.ts — Typed sessionStorage/localStorage helpers.
 * Uses crypto.randomUUID() (native browser API — no external dependency).
 */

import type { Campaign, Character, Session } from '../types';
import type { AdventureOptions } from './schemas';

const SESSION_KEY   = 'dm_session_v1';
const CAMPAIGNS_KEY = 'dm_campaigns_v1';
const CHARACTER_KEY = 'dm_character_v1';

export function generateId(): string {
  return crypto.randomUUID();
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ─── Session (tab-scoped) ────────────────────────────────────────────────────
export function saveSession(data: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}
export function loadSession(): Session | null {
  return safeParse<Session>(sessionStorage.getItem(SESSION_KEY));
}
export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Campaign summary list ──────────────────────────────────────────────────

export interface CampaignSummary {
  id: string;
  title: string;
  mode: string;
  setup: AdventureOptions;
  createdAt: number;
  updatedAt: number;
}

function loadCampaignsRaw(): CampaignSummary[] {
  return safeParse<CampaignSummary[]>(localStorage.getItem(CAMPAIGNS_KEY)) ?? [];
}

export function listCampaigns(): CampaignSummary[] {
  return loadCampaignsRaw().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Create a brand-new campaign record and return its generated ID. */
export function createCampaign(
  title: string,
  setup: AdventureOptions,
  _characters: string[] = []
): string {
  const id = generateId();
  const now = Date.now();
  const summary: CampaignSummary = {
    id,
    title: title.trim() || `Adventure — ${new Date(now).toLocaleDateString()}`,
    mode: setup.mode,
    setup,
    createdAt: now,
    updatedAt: now,
  };
  const list = loadCampaignsRaw();
  list.unshift(summary);
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));
  return id;
}

export function saveCampaign(campaign: Campaign): void {
  const list = loadCampaignsRaw().filter(c => c.id !== campaign.id);
  const summary: CampaignSummary = {
    id: campaign.id,
    title: campaign.setup.title,
    mode: campaign.setup.length,
    setup: campaign.setup as unknown as AdventureOptions,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
  list.unshift(summary);
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));
  localStorage.setItem(`dm_campaign_${campaign.id}`, JSON.stringify(campaign));
}

export function loadCampaign(id: string): Campaign | null {
  return safeParse<Campaign>(localStorage.getItem(`dm_campaign_${id}`));
}

export function deleteCampaign(id: string): void {
  const list = loadCampaignsRaw().filter(c => c.id !== id);
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));
  localStorage.removeItem(`dm_campaign_${id}`);
}

// ─── Character ───────────────────────────────────────────────────────────────
export function saveCharacter(data: Character): void {
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(data));
}
export function loadCharacter(): Character | null {
  return safeParse<Character>(localStorage.getItem(CHARACTER_KEY));
}
export function clearCharacter(): void {
  localStorage.removeItem(CHARACTER_KEY);
}
