/**
 * dm.ts — DM Orchestrator
 *
 * Responsibilities:
 * 1. Retrieve + decrypt the user’s API key from the vault
 * 2. Build the system prompt via systemPrompt.ts
 * 3. Window the conversation to stay within token budget
 * 4. Call llm.ts streamCompletion
 * 5. Persist each turn to the active campaign via storage.ts
 *
 * Security:
 * - The decrypted API key is held in a local variable for the duration of
 *   the async call and then GC’d. It is never written to storage or state.
 * - PBKDF2 key derivation happens inside WebCrypto (vault.ts).
 */

import { retrieveApiKey, listVaultEntries } from './vault';
import { buildSystemPrompt } from './systemPrompt';
import { streamCompletion } from './llm';
import { loadCampaign, saveCampaign, getActiveCampaignId } from './storage';
import type { StoredCampaign } from './storage';
import type { LLMConfig, Message } from '../types';

// Approximate token budget: keep last N chars of history (rough 4 chars/token)
// Reserve ~2000 tokens for system prompt + new response
const MAX_HISTORY_CHARS = 24_000; // ~6000 tokens of history

/** Result returned to the UI layer */
export interface DMSendResult {
  aborted: boolean;
}

/**
 * Send a user message to the DM and stream the response.
 *
 * @param userText      The player’s message
 * @param passphrase    The vault passphrase (collected in-UI, never stored)
 * @param onChunk       Called with each streamed text fragment
 * @param onDone        Called when the stream completes successfully
 * @param onError       Called with a user-friendly error string
 * @param signal        AbortSignal for component unmount / cancel
 */
export async function sendToDM(
  userText: string,
  passphrase: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (msg: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  // ── 1. Load campaign ─────────────────────────────────────────────────────────
  const campaignId = getActiveCampaignId();
  const campaign: StoredCampaign | null = campaignId ? loadCampaign(campaignId) : null;
  if (!campaign) { onError('No active campaign found. Please start a new adventure.'); return; }

  // ── 2. Decrypt API key ─────────────────────────────────────────────────
  const entries = listVaultEntries();
  if (entries.length === 0) { onError('No API key configured. Add one in Settings.'); return; }
  const entry = entries[0]; // Use first non-expired key
  const apiKey = await retrieveApiKey(passphrase, entry.provider, entry.label);
  if (!apiKey) {
    onError('Incorrect passphrase or the key has expired. Check Settings.');
    return;
  }

  if (signal?.aborted) return;

  // ── 3. Build messages array ───────────────────────────────────────────────
  const systemMsg: Message = {
    role: 'system',
    content: buildSystemPrompt(campaign),
    timestamp: new Date().toISOString(),
  };

  // Window history to stay within token budget
  const history = campaign.messages.filter(m => m.role !== 'system');
  const windowed = windowHistory(history, MAX_HISTORY_CHARS);

  const userMsg: Message = {
    role: 'user',
    content: userText.trim(),
    timestamp: new Date().toISOString(),
  };

  const messages: Message[] = [systemMsg, ...windowed, userMsg];

  // ── 4. LLM config ───────────────────────────────────────────────────────────
  const llmConfig: LLMConfig = {
    provider: entry.provider as LLMConfig['provider'],
    model: entry.model,
    maxTokens: 1024,
    temperature: 0.85,
  };

  // ── 5. Stream ────────────────────────────────────────────────────────────────
  let fullText = '';

  await streamCompletion(
    llmConfig,
    apiKey,
    messages,
    (chunk) => {
      if (signal?.aborted) return;
      fullText += chunk;
      onChunk(chunk);
    },
    () => {
      if (signal?.aborted) return;
      // ── 6. Persist both turns to campaign ─────────────────────────────
      const latest = loadCampaign(campaignId!);
      if (latest) {
        latest.messages.push(
          { role: 'user', content: userMsg.content, timestamp: userMsg.timestamp },
          { role: 'assistant', content: fullText, timestamp: new Date().toISOString() },
        );
        saveCampaign(latest);
      }
      onDone(fullText);
    },
    (err) => {
      onError(friendlyError(err));
    },
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Keep the most recent messages that fit within the char budget */
function windowHistory(messages: Message[], maxChars: number): Message[] {
  let total = 0;
  const result: Message[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length;
    if (total > maxChars) break;
    result.unshift(messages[i]);
  }
  return result;
}

/** Map raw errors to user-friendly strings */
function friendlyError(err: Error): string {
  const msg = err.message ?? '';
  if (msg.includes('401') || msg.includes('403')) return 'API key rejected by provider. Check your key in Settings.';
  if (msg.includes('429')) return 'Rate limit hit. Wait a moment and try again.';
  if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return 'Provider is having issues. Try again in a moment.';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Network error. Check your internet connection.';
  return `DM error: ${msg.slice(0, 120)}`;
}
