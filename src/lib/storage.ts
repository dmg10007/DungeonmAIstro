/**
 * storage.ts — Typed sessionStorage/localStorage helpers.
 * Uses crypto.randomUUID() (native browser API — no external dependency).
 */

import type { Campaign, Character, Session } from '../types';

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

// ─── Campaigns (persisted) ───────────────────────────────────────────────────
type CampaignSummary = Pick<Campaign, 'id' | 'setup' | 'createdAt' | 'updatedAt'> & { title: string; mode: string };

function loadCampaignsRaw(): CampaignSummary[] {
  return safeParse<CampaignSummary[]>(localStorage.getItem(CAMPAIGNS_KEY)) ?? [];
}

export function listCampaigns(): CampaignSummary[] {
  return loadCampaignsRaw().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveCampaign(campaign: Campaign): void {
  const list = loadCampaignsRaw().filter(c => c.id !== campaign.id);
  const summary: CampaignSummary = {
    id: campaign.id,
    setup: campaign.setup,
    title: campaign.setup.title,
    mode: campaign.setup.length,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
  list.unshift(summary);
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(list));
  // Also store full campaign data under its own key
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
