/**
 * dm.ts — Dungeon Master orchestration layer.
 *
 * Pulls the active campaign + characters from storage, decrypts the stored
 * API key using the caller-supplied passphrase, builds a rich system prompt,
 * then streams the LLM response back via callbacks.
 *
 * RAG: before building the final system prompt, the user query is used to
 * retrieve the top-5 most relevant chunks from the local IndexedDB knowledge
 * base (uploaded PDFs). These are injected as a ## Rules & Lore Reference
 * section. Retrieval is skipped silently if the knowledge base is empty or
 * if the embedding call fails.
 *
 * The __OPEN_SCENE__ sentinel triggers a special opening-narration prompt
 * instead of echoing the raw sentinel text to the user or the LLM.
 */

import { streamCompletion } from './llm';
import { getActiveCampaignId, loadCampaign, saveCampaign } from './storage';
import { listVaultEntries, retrieveApiKey } from './vault';
import { retrieveContext, hasKnowledge } from './knowledge';
import type { Message } from '../types';

const OPEN_SCENE_SENTINEL = '__OPEN_SCENE__';

function buildSystemPrompt(campaign: ReturnType<typeof loadCampaign>, rulesContext: string): string {
  if (!campaign) return '';

  const { options, characters, title } = campaign;

  const partyDesc =
    characters.length > 0
      ? characters
          .map(
            (c) =>
              `- ${c.characterName} (${c.race} ${c.class}, Level ${c.level}, Background: ${c.background})`,
          )
          .join('\n')
      : '- No characters registered yet (treat as a solo adventurer of unspecified origin).';

  const experienceGuide =
    options.experienceLevel === 'new'
      ? 'The player is BRAND NEW to D&D. Explain mechanics clearly as they arise, use simple language, avoid jargon without definition, and be encouraging and patient.'
      : options.experienceLevel === 'beginner'
      ? 'The player has some D&D experience but may need reminders on rules. Explain non-obvious mechanics briefly.'
      : options.experienceLevel === 'intermediate'
      ? 'The player is comfortable with D&D rules. Assume working knowledge; only explain unusual rulings.'
      : 'The player is experienced. Use full D&D terminology freely.';

  const rulesGuide = [
    'By the Book — follow RAW strictly',
    'Mostly RAW — minor narrative flexibility',
    'Balanced — equal story and rules',
    'Flexible — story over rules when needed',
    'Rule of Cool — narrative and dramatic moments first',
  ][options.rulesStrictness - 1];

  const narrativeGuide = [
    'Pure Narrative — roleplay and story only, minimize dice',
    'Story-first — narrative leads, dice punctuate key moments',
    'Balanced — story and dice equally important',
    'Dice-leaning — dice outcomes drive the narrative',
    'Dice Heavy — dice govern most outcomes, minimal narrative override',
  ][options.narrativeStyle - 1];

  const toneDesc = options.tone.join(', ');

  const safetyNote =
    options.safetyMode === 'strict'
      ? 'Content must be family-friendly. No graphic violence, adult themes, or horror.'
      : 'Keep content PG-13. Dramatic tension and mild peril are fine; avoid graphic or explicit content.';

  const modeNote =
    options.mode === 'one_shot'
      ? 'This is a ONE-SHOT adventure. It must have a clear beginning, middle, and end completable in a single session (roughly 2-4 hours of play). Build toward a satisfying climax.'
      : 'This is a multi-session CAMPAIGN. Build an evolving world with persistent consequences, recurring characters, and escalating stakes.';

  const promptNote = options.customPrompt
    ? `\nThe player requested this specific adventure premise: "${options.customPrompt}"\nBuild the campaign directly around this premise.`
    : '';

  const sections = [
    `You are the Dungeon Master for a D&D 5e ${options.mode === 'one_shot' ? 'one-shot' : 'campaign'} titled "${title}".`,
    '',
    '## Your Role',
    'You are a highly skilled, creative, and adaptive DM. You narrate the world vividly, voice NPCs with personality, adjudicate rules fairly, track all dice rolls and outcomes, and guide the player through an engaging story. You are the sole narrator — never break the fourth wall unless explaining a mechanic to a new player.',
    '',
    '## Adventure Mode',
    modeNote,
    promptNote,
    '',
    '## Party',
    partyDesc,
    '',
    '## Player Experience',
    experienceGuide,
    '',
    '## Tone',
    `The desired tone is: ${toneDesc}. Lean into these qualities in your descriptions, NPC dialogue, and scene-setting.`,
    '',
    '## Rules Approach',
    rulesGuide,
    '',
    '## Narrative vs Dice Balance',
    narrativeGuide,
    '',
    '## Safety',
    safetyNote,
    '',
    '## Mechanics to Track',
    '- When a dice roll is required, call it out explicitly: e.g. "Roll a DC 14 Perception check."',
    '- When the player reports a roll result, incorporate it into the narrative outcome.',
    '- Track HP, conditions, and resources mentioned by the player.',
    '- For combat, describe initiative order and enemy actions clearly.',
    '',
    '## Response Style',
    '- Use **bold** for important names, places, and mechanics.',
    '- Use *italics* for atmosphere, whispered speech, or internal sensations.',
    '- Keep responses focused and immersive. Avoid walls of text — break long descriptions into paragraphs.',
    '- End most responses with an implicit or explicit prompt for the player to act.',
  ];

  // Inject retrieved knowledge context if available
  if (rulesContext.trim()) {
    sections.push('', rulesContext);
  }

  return sections.filter((l) => l !== null).join('\n');
}

function buildOpenScenePrompt(campaign: ReturnType<typeof loadCampaign>): string {
  if (!campaign) return 'Begin the adventure with a compelling opening scene.';
  const { options } = campaign;
  const promptHint = options.customPrompt
    ? ` The player requested: "${options.customPrompt}".`
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
    // RAG failure must never break the game — continue without context
    rulesContext = '';
  }

  // 4. Build messages
  // Filter out 'system' and 'event' roles — 'event' messages are display-only
  // (dice rolls, local game events) and must never be sent to the LLM API.
  const systemPrompt = buildSystemPrompt(campaign, rulesContext);
  const isOpenScene = userInput.trim() === OPEN_SCENE_SENTINEL;
  const actualUserMessage = isOpenScene ? buildOpenScenePrompt(campaign) : userInput.trim();

  const history: Message[] = campaign.messages.filter(
    (m) => m.role !== 'system' && m.role !== 'event'
  );
  const messages: Message[] = [
    { role: 'system', content: systemPrompt, timestamp: new Date().toISOString() },
    ...history,
    { role: 'user', content: actualUserMessage, timestamp: new Date().toISOString() },
  ];

  // 5. Stream — llm.ts now owns accumulation and guarantees onDone(fullText) or onError
  await streamCompletion(
    { provider: entry.provider, model: entry.model },
    apiKey,
    messages,
    onChunk,
    (fullText) => {
      // Persist only user/assistant messages — never 'event' messages
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
