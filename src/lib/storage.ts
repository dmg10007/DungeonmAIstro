/**
 * Campaign Event Log Storage
 * Append-only event log stored in localStorage.
 * Current state is projected from events rather than mutated directly.
 */
import { campaignSchema, campaignEventSchema, type Campaign, type CampaignEvent } from './schemas';

const CAMPAIGNS_KEY = 'dm-campaigns';
const ACTIVE_KEY = 'dm-active-campaign';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Load all campaigns from storage. Invalid entries are silently dropped. */
export function loadCampaigns(): Campaign[] {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((c) => campaignSchema.safeParse(c))
      .filter((r) => r.success)
      .map((r) => (r as { success: true; data: Campaign }).data);
  } catch {
    return [];
  }
}

/** Persist all campaigns to storage. */
function saveCampaigns(campaigns: Campaign[]): void {
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(campaigns));
}

/** Create a new campaign. */
export function createCampaign(partial: Omit<Campaign, 'id' | 'events' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Campaign {
  const campaign: Campaign = {
    ...partial,
    id: generateId(),
    events: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schemaVersion: 1,
  };
  const all = loadCampaigns();
  all.push(campaign);
  saveCampaigns(all);
  return campaign;
}

/** Load a single campaign by ID. */
export function loadCampaign(id: string): Campaign | null {
  return loadCampaigns().find((c) => c.id === id) ?? null;
}

/** Append an event to a campaign's event log. */
export function appendEvent(
  campaignId: string,
  eventType: CampaignEvent['type'],
  payload: Record<string, unknown>,
): CampaignEvent | null {
  const all = loadCampaigns();
  const idx = all.findIndex((c) => c.id === campaignId);
  if (idx === -1) return null;

  const event: CampaignEvent = campaignEventSchema.parse({
    id: generateId(),
    type: eventType,
    timestamp: Date.now(),
    payload,
  });

  all[idx] = {
    ...all[idx],
    events: [...all[idx].events, event],
    updatedAt: Date.now(),
  };
  saveCampaigns(all);
  return event;
}

/** Update a campaign's character list. */
export function updateCampaignCharacters(
  campaignId: string,
  characters: Campaign['characters'],
): void {
  const all = loadCampaigns();
  const idx = all.findIndex((c) => c.id === campaignId);
  if (idx === -1) return;
  all[idx] = { ...all[idx], characters, updatedAt: Date.now() };
  saveCampaigns(all);
}

/** Delete a campaign. */
export function deleteCampaign(id: string): void {
  saveCampaigns(loadCampaigns().filter((c) => c.id !== id));
  if (getActiveCampaignId() === id) clearActiveCampaign();
}

export function setActiveCampaign(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveCampaignId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function clearActiveCampaign(): void {
  localStorage.removeItem(ACTIVE_KEY);
}
