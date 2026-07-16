import { z } from 'zod';

// ----------------------------------------------------------------
// API Key Vault
// ----------------------------------------------------------------
export const LLMProvider = z.enum([
  'openai',
  'anthropic',
  'google',
  'groq',
  'openrouter',
  'custom',
]);
export type LLMProvider = z.infer<typeof LLMProvider>;

export const apiKeyEntrySchema = z.object({
  provider: LLMProvider,
  label: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  baseUrl: z.string().url().optional(),
  storedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});
export type ApiKeyEntry = z.infer<typeof apiKeyEntrySchema>;

// ----------------------------------------------------------------
// Ruleset
// ----------------------------------------------------------------
export const Ruleset = z.enum([
  'dnd5e',
  'pathfinder2e',
  'callofcthulhu7e',
  'shadowrun6e',
  'custom',
]);
export type Ruleset = z.infer<typeof Ruleset>;

// ----------------------------------------------------------------
// Dice
// ----------------------------------------------------------------
export const dieFaceSchema = z.union([
  z.literal(4), z.literal(6), z.literal(8),
  z.literal(10), z.literal(12), z.literal(20), z.literal(100),
]);
export type DieFace = z.infer<typeof dieFaceSchema>;

export const diceNotationSchema = z
  .string()
  .regex(/^(\d{1,2})?d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i, 'Invalid dice notation');

export const diceRollResultSchema = z.object({
  notation: diceNotationSchema,
  rolls: z.array(z.number().int()),
  modifier: z.number().int(),
  total: z.number().int(),
  actorType: z.enum(['player', 'npc', 'system']),
  actorId: z.string().optional(),
  reason: z.string().max(200).optional(),
  timestamp: z.string().datetime(),
});
export type DiceRollResult = z.infer<typeof diceRollResultSchema>;

// ----------------------------------------------------------------
// Character
// ----------------------------------------------------------------
//
// Numeric bounds are intentionally wide so the schema works across all
// supported rulesets without per-system branching:
//
//   Ability scores / characteristics
//     D&D 5e / PF2e : 1–30
//     Shadowrun 6e  : 1–9  (stored as-is)
//     CoC 7e        : 1–90 (3d6×5 etc.)
//     → max 100 for homebrew headroom
//
//   Proficiency bonus
//     D&D 5e / PF2e : 2–6
//     CoC 7e / SR6e : concept does not exist → 0
//     → min 0, max 12
//
//   Armor Class / Defence
//     D&D 5e        : typically 10–30
//     CoC 7e        : Dodge % can be 0–99
//     → min 0, max 99
//
//   Level / Era / Rank
//     D&D 5e        : 1–20
//     PF2e          : 1–20
//     CoC 7e        : no levels (store 1)
//     SR6e          : Karma track, no hard cap
//     → min 0 (so CoC characters don't fail), max 30
//
//   Speed
//     D&D 5e        : 0–120 ft
//     CoC 7e        : MOV stored as 1–99
//     → min 0, max 999

export const abilityScoresSchema = z.object({
  str: z.number().int().min(1).max(100),
  dex: z.number().int().min(1).max(100),
  con: z.number().int().min(1).max(100),
  int: z.number().int().min(1).max(100),
  wis: z.number().int().min(1).max(100),
  cha: z.number().int().min(1).max(100),
});
export type AbilityScores = z.infer<typeof abilityScoresSchema>;

export const characterSchema = z.object({
  id: z.string().uuid(),
  characterName: z.string().min(1).max(100),
  playerName: z.string().max(100).optional(),
  race: z.string().min(1).max(50),
  class: z.string().min(1).max(50),
  background: z.string().max(50).optional(),
  alignment: z.string().max(30).optional(),
  // min(0) — rulesets without levels (CoC 7e) store 0 or 1
  level: z.number().int().min(0).max(30),
  experiencePoints: z.number().int().min(0).optional(),
  abilityScores: abilityScoresSchema,
  // min(0) — rulesets without a proficiency bonus (CoC 7e, SR6e) store 0
  proficiencyBonus: z.number().int().min(0).max(12),
  // max(99) — CoC 7e Dodge skill is a percentage
  armorClass: z.number().int().min(0).max(99),
  initiative: z.number().int().optional(),
  // max(999) — covers ft (D&D) and MOV values (CoC)
  speed: z.number().int().min(0).max(999),
  hitPointMaximum: z.number().int().min(1).max(999),
  currentHitPoints: z.number().int().min(0).max(999),
  temporaryHitPoints: z.number().int().min(0).max(999).optional(),
  skills: z.record(z.string(), z.boolean()).optional(),
  savingThrows: z.record(z.string(), z.boolean()).optional(),
  attacks: z.array(z.object({
    name: z.string().max(80),
    atkBonus: z.string().max(10),
    damageType: z.string().max(30),
  })).optional(),
  equipment: z.string().max(2000).optional(),
  traits: z.string().max(2000).optional(),
  ideals: z.string().max(500).optional(),
  bonds: z.string().max(500).optional(),
  flaws: z.string().max(500).optional(),
  spellcastingClass: z.string().max(50).optional(),
  spellcastingAbility: z.string().max(5).optional(),
  spellSaveDC: z.number().int().optional(),
  spellAttackBonus: z.number().int().optional(),
  spells: z.string().max(4000).optional(),
  source: z.enum(['manual', 'pdf_import']),
  createdAt: z.string().datetime(),
});
export type Character = z.infer<typeof characterSchema>;

// ----------------------------------------------------------------
// Adventure / Campaign
// ----------------------------------------------------------------
export const adventureOptionsSchema = z.object({
  /** Which TTRPG ruleset the DM should run. Immutable after campaign creation. */
  ruleset: Ruleset.default('dnd5e'),
  /** Display name / short description for a custom homebrew ruleset. */
  customRulesetName: z.string().max(80).optional(),
  customRulesetDescription: z.string().max(2000).optional(),
  mode: z.enum(['one_shot', 'campaign']),
  playerCount: z.number().int().min(1).max(4),
  experienceLevel: z.enum(['new', 'intermediate', 'expert']),
  tone: z.array(z.string().min(1).max(30)).min(1).max(10),
  desiredLength: z.string().min(1).max(100),
  settingPrompt: z.string().max(4000),
  safetyMode: z.enum(['strict', 'balanced']),
  /** 1 = By the Book (strict RAW), 3 = Balanced (default), 5 = Rule of Cool */
  rulesStrictness: z.number().int().min(1).max(5).default(3),
  /** 1 = Pure Narrative (minimal dice), 3 = Balanced (default), 5 = Dice Heavy */
  narrativeStyle: z.number().int().min(1).max(5).default(3),
  /** 1 = Terse (short punchy replies), 3 = Balanced (default), 5 = Verbose (rich detail) */
  responseVerbosity: z.number().int().min(1).max(5).default(3),
});
export type AdventureOptions = z.infer<typeof adventureOptionsSchema>;

// ----------------------------------------------------------------
// Campaign Event Log
// ----------------------------------------------------------------
export const campaignEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session_started'), timestamp: z.string().datetime(), options: adventureOptionsSchema }),
  z.object({ type: z.literal('character_added'), timestamp: z.string().datetime(), character: characterSchema }),
  z.object({ type: z.literal('scene_opened'), timestamp: z.string().datetime(), sceneId: z.string(), description: z.string().max(5000) }),
  z.object({ type: z.literal('dice_rolled'), timestamp: z.string().datetime(), result: diceRollResultSchema }),
  z.object({ type: z.literal('npc_introduced'), timestamp: z.string().datetime(), npcId: z.string(), name: z.string().max(100), description: z.string().max(1000) }),
  z.object({ type: z.literal('combat_started'), timestamp: z.string().datetime(), participants: z.array(z.string()) }),
  z.object({ type: z.literal('combat_round_advanced'), timestamp: z.string().datetime(), round: z.number().int().min(1) }),
  z.object({ type: z.literal('combat_ended'), timestamp: z.string().datetime() }),
  z.object({ type: z.literal('quest_updated'), timestamp: z.string().datetime(), questId: z.string(), status: z.enum(['active', 'completed', 'failed']), note: z.string().max(500).optional() }),
  z.object({ type: z.literal('inventory_changed'), timestamp: z.string().datetime(), characterId: z.string(), change: z.string().max(300) }),
  z.object({ type: z.literal('session_ended'), timestamp: z.string().datetime() }),
]);
export type CampaignEvent = z.infer<typeof campaignEventSchema>;

export const campaignStateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  options: adventureOptionsSchema,
  characters: z.array(characterSchema),
  events: z.array(campaignEventSchema),
  messages: z.array(z.object({
    // 'event' messages are display-only (dice rolls, local game events).
    // They must be filtered out before saveCampaign is called so they are
    // never persisted to storage or sent to any LLM API.
    // The enum includes 'event' here only so Zod does not reject the array
    // if a caller accidentally passes one through — storage.ts strips them.
    role: z.enum(['user', 'assistant', 'system', 'event']),
    content: z.string().max(32000),
    timestamp: z.string().datetime(),
  })),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CampaignState = z.infer<typeof campaignStateSchema>;
