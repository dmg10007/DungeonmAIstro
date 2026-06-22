/**
 * Campaign Event Log
 * Append-only event store in localStorage.
 * State is derived from events, never mutated in place.
 */

import { z } from 'zod';
import { CampaignSchema, CampaignEventSchema, type Campaign, type CampaignEvent } from './schemas';

const CAMPAIGNS_KEY = 'dmg_campaigns_v1';
const SCHEMA_VERSION = 1;

interface StorageEnvelope {
  version: number;
  campaigns: unknown[];
}

function loadEnvelope(): StorageEnvelope {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (!raw) return { version: SCHEMA_VERSION, campaigns: [] };
    const parsed = JSON.parse(raw) as StorageEnvelope;
    if (parsed.version !== SCHEMA_VERSION) {
      // Future: run migrations here
      console.warn('[storage] Version mismatch — using empty store.');
      return { version: SCHEMA_VERSION, campaigns: [] };
    }
    return parsed;
  } catch {
    return { version: SCHEMA_VERSION, campaigns: [] };
  }
}

function saveEnvelope(envelope: StorageEnvelope): void {
  localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(envelope));
}

/** Load and validate all campaigns from localStorage. */
export function loadAllCampaigns(): Campaign[] {
  const { campaigns } = loadEnvelope();
  return campaigns
    .map((c) => {
      const result = CampaignSchema.safeParse(c);
      if (!result.success) {
        console.warn('[storage] Skipping invalid campaign record:', result.error.flatten());
        return null;
      }
      return result.data;
    })
    .filter((c): c is Campaign => c !== null);
}

/** Save or overwrite a campaign. */
export function saveCampaign(campaign: Campaign): void {
  const validated = CampaignSchema.parse(campaign);
  const envelope = loadEnvelope();
  const others = (envelope.campaigns as Campaign[]).filter((c) => {
    const r = CampaignSchema.safeParse(c);
    return r.success && r.data.id !== validated.id;
  });
  saveEnvelope({ ...envelope, campaigns: [...others, validated] });
}

/** Append an event to a campaign's event log. */
export function appendEvent(campaignId: string, event: CampaignEvent): void {
  const campaigns = loadAllCampaigns();
  const idx = campaigns.findIndex((c) => c.id === campaignId);
  if (idx === -1) throw new Error(`Campaign ${campaignId} not found`);

  const validated = CampaignEventSchema.parse(event);
  const updated: Campaign = {
    ...campaigns[idx],
    events: [...campaigns[idx].events, validated],
    updatedAt: Date.now(),
  };
  saveCampaign(updated);
}

/** Delete a campaign by id. */
export function deleteCampaign(campaignId: string): void {
  const envelope = loadEnvelope();
  const filtered = (envelope.campaigns as Campaign[]).filter((c) => {
    const r = CampaignSchema.safeParse(c);
    return r.success && r.data.id !== campaignId;
  });
  saveEnvelope({ ...envelope, campaigns: filtered });
}

/** Export all campaigns as a JSON blob (for manual backup). */
export function exportAllCampaigns(): string {
  return JSON.stringify(loadEnvelope(), null, 2);
}

/** Import campaigns from a JSON string. Validates every record. */
export function importCampaigns(json: string): { imported: number; skipped: number } {
  const parsed = z.object({
    version: z.number(),
    campaigns: z.array(z.unknown()),
  }).parse(JSON.parse(json));

  let imported = 0;
  let skipped = 0;
  for (const raw of parsed.campaigns) {
    const result = CampaignSchema.safeParse(raw);
    if (result.success) {
      saveCampaign(result.data);
      imported++;
    } else {
      skipped++;
    }
  }
  return { imported, skipped };
}
