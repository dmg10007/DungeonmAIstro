/**
 * storage.ts — Append-only campaign event log + campaign state
 *
 * Stores an array of typed CampaignEvents and derived CampaignState.
 * State is projected from events on load, making future
 * migration to Supabase straightforward.
 */

import { v4 as uuidv4 } from 'https://esm.sh/uuid@9';
import { campaignStateSchema } from './schemas';
import type { CampaignState, CampaignEvent, AdventureOptions, Character } from './schemas';

const CAMPAIGNS_KEY = 'dm_campaigns_v1';
const ACTIVE_CAMPAIGN_KEY = 'dm_active_campaign_v1';

/** Generate a UUID (crypto-backed) */
export function newId(): string {
  return uuidv4();
}

/** Save full campaign state to localStorage */
export function saveCampaign(state: CampaignState): void {
  const all = loadAllCampaigns();
  all[state.id] = { ...state, updatedAt: new Date().toISOString() };
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(all));
}

/** Load a single campaign by ID, validated with Zod */
export function loadCampaign(id: string): CampaignState | null {
  const all = loadAllCampaigns();
  const raw = all[id];
  if (!raw) return null;
  const parsed = campaignStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** List all campaign summaries */
export function listCampaigns(): { id: string; title: string; updatedAt: string; mode: string }[] {
  const all = loadAllCampaigns();
  return Object.values(all).map(c => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    mode: c.options.mode,
  }));
}

/** Delete a campaign */
export function deleteCampaign(id: string): void {
  const all = loadAllCampaigns();
  delete all[id];
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(all));
  if (getActiveCampaignId() === id) clearActiveCampaign();
}

/** Append an event to the campaign's event log */
export function appendEvent(campaignId: string, event: CampaignEvent): void {
  const state = loadCampaign(campaignId);
  if (!state) throw new Error(`Campaign ${campaignId} not found`);
  state.events.push(event);
  saveCampaign(state);
}

/** Create a new campaign from options + characters */
export function createCampaign(
  title: string,
  options: AdventureOptions,
  characters: Character[]
): CampaignState {
  const now = new Date().toISOString();
  const state: CampaignState = {
    id: newId(),
    title,
    options,
    characters,
    events: [{ type: 'session_started', timestamp: now, options }],
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  saveCampaign(state);
  setActiveCampaign(state.id);
  return state;
}

/** Active campaign helpers */
export function getActiveCampaignId(): string | null {
  return sessionStorage.getItem(ACTIVE_CAMPAIGN_KEY);
}
export function setActiveCampaign(id: string): void {
  sessionStorage.setItem(ACTIVE_CAMPAIGN_KEY, id);
}
export function clearActiveCampaign(): void {
  sessionStorage.removeItem(ACTIVE_CAMPAIGN_KEY);
}

function loadAllCampaigns(): Record<string, CampaignState> {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CampaignState>;
  } catch { return {}; }
}
