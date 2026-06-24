/**
 * dm.ts — Dungeon Master orchestration layer.
 *
 * Pulls the active campaign + characters from storage, decrypts the stored
 * API key using the caller-supplied passphrase, builds a rich system prompt
 * via systemPrompt.ts (which owns rules-strictness, narrative-style,
 * response-verbosity, and critical-roll rules), then streams the LLM
 * response back via callbacks.
 *
 * RAG: before building the final system prompt, the user query is used to
 * retrieve the top-5 most relevant chunks from the local IndexedDB knowledge
 * base (uploaded PDFs). These are appended as a ## Rules & Lore Reference
 * section after the structured prompt. Retrieval is skipped silently if the
 * knowledge base is empty or if the embedding call fails.
 *
 * The __OPEN_SCENE__ sentinel triggers a special opening-narration prompt
 * instead of echoing the raw sentinel text to the user or the LLM.
 */

import { streamCompletion } from './llm';
import { getActiveCampaignId, loadCampaign, saveCampaign } from './storage';
import { listVaultEntries, retrieveApiKey } from './vault';
import { retrieveContext, hasKnowledge } from './knowledge';
import { buildSystemPrompt } from './systemPrompt';
import type { Message } from '../types';

const OPEN_SCENE_SENTINEL = '__OPEN_SCENE__';

function buildOpenScenePrompt(campaign: NonNullable<ReturnType<typeof loadCampaign>>): string {
  const { options } = campaign;
  const promptHint = options.settingPrompt
    ? ` The player requested: "${options.settingPrompt}".`
    : '';
  return (
    `Begin the adventure now. Open with a vivid, immersive scene that immediately draws the player into the world.` +
    ` The tone should be ${options.tone.join(', ')}.${promptHint}` +
    ` End the opening scene with a clear hook or decision point for the player.`
  );
}

export async function sendToDM(
  userInput: string,
  passphrase: string,
  onChunk: (chunk: string) => void,
  onDone: (fullText: string) => void,
  onError: (message: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  // 1. Load campaign
  const campaignId = getActiveCampaignId();
  if (!campaignId) { onError('No active campaign. Start a new adventure first.'); return; }
  const campaign = loadCampaign(campaignId);
  if (!campaign) { onError('Campaign data not found. Please start a new adventure.'); return; }

  // 2. Decrypt API key
  const entries = listVaultEntries();
  if (entries.length === 0) { onError('No API key found. Add one in Settings.'); return; }
  const entry = entries[0];
  let apiKey: string | null = null;
  try {
    apiKey = await retrieveApiKey(passphrase, entry.provider, entry.label);
  } catch {
    onError('Incorrect passphrase or corrupted vault. Please re-enter your vault passphrase.');
    return;
  }
  if (!apiKey) { onError('API key expired or not found. Please re-add it in Settings.'); return; }

  const baseUrl = (entry as { baseUrl?: string }).baseUrl;

  // 3. RAG retrieval — silently skip if knowledge base is empty or errors
  let rulesContext = '';
  try {
    const kb = await hasKnowledge();
    if (kb) {
      const query = userInput === OPEN_SCENE_SENTINEL
        ? `D&D 5e opening scene: ${campaign.options.tone.join(', ')} tone`
        : userInput;
      rulesContext = await retrieveContext(query, apiKey, entry.provider, baseUrl);
    }
  } catch {
    rulesContext = '';
  }

  // 4. Build system prompt via systemPrompt.ts (owns verbosity, crits, rules, narrative)
  //    Append RAG context as a trailing section when available.
  const structuredPrompt = buildSystemPrompt(campaign);
  const systemPrompt = rulesContext.trim()
    ? `${structuredPrompt}\n\n---\n\n${rulesContext.trim()}`
    : structuredPrompt;

  // 5. Resolve actual user message (sentinel → opening scene prompt)
  const isOpenScene = userInput.trim() === OPEN_SCENE_SENTINEL;
  const actualUserMessage = isOpenScene ? buildOpenScenePrompt(campaign) : userInput.trim();

  // 6. Build message array — strip 'system' and 'event' roles from history
  const history: Message[] = campaign.messages.filter(
    (m) => m.role !== 'system' && m.role !== 'event'
  );
  const messages: Message[] = [
    { role: 'system', content: systemPrompt, timestamp: new Date().toISOString() },
    ...history,
    { role: 'user', content: actualUserMessage, timestamp: new Date().toISOString() },
  ];

  // 7. Stream
  await streamCompletion(
    { provider: entry.provider, model: entry.model },
    apiKey,
    messages,
    onChunk,
    (fullText) => {
      const updatedMessages = [
        ...campaign.messages.filter((m) => m.role !== 'system' && m.role !== 'event'),
        { role: 'user' as const, content: userInput, timestamp: new Date().toISOString() },
        { role: 'assistant' as const, content: fullText, timestamp: new Date().toISOString() },
      ];
      saveCampaign({ ...campaign, messages: updatedMessages });
      onDone(fullText);
    },
    (err) => {
      const msg = err.message ?? String(err);
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        onError('API key rejected (401). Check your key in Settings.');
      } else if (msg.includes('429')) {
        onError('Rate limit reached (429). Wait a moment and try again.');
      } else if (msg.includes('503') || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('unavailable')) {
        onError('The model is temporarily overloaded (503). Wait a moment and try again.');
      } else {
        onError(`DM error: ${msg}`);
      }
    },
    signal,
  );
}
