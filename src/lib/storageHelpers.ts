/**
 * storageHelpers.ts — Higher-level helpers that compose storage primitives.
 * Kept separate so storage.ts stays focused on raw CRUD.
 */
import { getActiveCampaignId, loadCampaign, saveCampaign } from './storage';
import type { StoredCharacterRef } from './storage';

/** Attach a character to the currently active campaign. No-op if no active campaign. */
export function addCharacterToActiveCampaign(ref: StoredCharacterRef): void {
  const id = getActiveCampaignId();
  if (!id) return;
  const campaign = loadCampaign(id);
  if (!campaign) return;
  // Avoid duplicates
  if (campaign.characters.some(c => c.id === ref.id)) return;
  campaign.characters.push(ref);
  saveCampaign(campaign);
}
