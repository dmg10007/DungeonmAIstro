import { z } from 'zod';

// ---- API Key Vault ----
export const LLMProvider = z.enum([
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'custom',
]);
export type LLMProvider = z.infer<typeof LLMProvider>;

export const ApiKeyEntrySchema = z.object({
  provider: LLMProvider,
  label: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  baseUrl: z.string().url().optional(),
  encryptedKey: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().min(1),
  expiresAt: z.number().positive(), // unix ms
});
export type ApiKeyEntry = z.infer<typeof ApiKeyEntrySchema>;

// ---- Dice ----
export const DieFace = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
  z.literal(10),
  z.literal(12),
  z.literal(20),
  z.literal(100),
]);
export type DieFace = z.infer<typeof DieFace>;

export const DiceNotationSchema = z
  .string()
  .regex(/^(\d{1,2})?d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/, {
    message: 'Invalid dice notation. Examples: d20, 2d6, 1d8+3, d100',
  });

export const DiceRollResultSchema = z.object({
  notation: z.string(),
  rolls: z.array(z.number().int().positive()),
  modifier: z.number().int(),
  total: z.number().int(),
  actorType: z.enum(['player', 'npc', 'system']),
  actorId: z.string().optional(),
  reason: z.string().max(200).optional(),
  timestamp: z.number().positive(),
});
export type DiceRollResult = z.infer<typeof DiceRollResultSchema>;

// ---- Ability Scores ----
const AbilityScore = z.number().int().min(1).max(30);

export const AbilityScoresSchema = z.object({
  str: AbilityScore,
  dex: AbilityScore,
  con: AbilityScore,
  int: AbilityScore,
  wis: AbilityScore,
  cha: AbilityScore,
});
export type AbilityScores = z.infer<typeof AbilityScoresSchema>;

// ---- Character ----
export const ExperienceLevel = z.enum(['new', 'intermediate', 'expert']);
export type ExperienceLevel = z.infer<typeof ExperienceLevel>;

export const CharacterSchema = z.object({
  id: z.string().uuid(),
  characterName: z.string().min(1).max(100),
  playerName: z.string().max(100).optional(),
  race: z.string().min(1).max(50),
  class: z.string().min(1).max(50),
  subclass: z.string().max(80).optional(),
  background: z.string().max(80).optional(),
  level: z.number().int().min(1).max(20),
  experiencePoints: z.number().int().min(0).optional(),
  abilityScores: AbilityScoresSchema,
  proficiencyBonus: z.number().int().min(2).max(6),
  armorClass: z.number().int().min(1).max(50),
  initiative: z.number().int().min(-5).max(20),
  speed: z.number().int().min(0).max(120),
  hitPointMaximum: z.number().int().min(1).max(999),
  currentHitPoints: z.number().int().min(0).max(999),
  temporaryHitPoints: z.number().int().min(0).max(999).default(0),
  hitDice: z.string().max(20).optional(),
  deathSaves: z.object({
    successes: z.number().int().min(0).max(3),
    failures:  z.number().int().min(0).max(3),
  }).default({ successes: 0, failures: 0 }),
  skills: z.record(z.string(), z.boolean()).optional(),
  savingThrows: z.record(z.string(), z.boolean()).optional(),
  equipment: z.array(z.string().max(200)).optional(),
  traits: z.string().max(2000).optional(),
  ideals: z.string().max(1000).optional(),
  bonds: z.string().max(1000).optional(),
  flaws: z.string().max(1000).optional(),
  spellcastingClass: z.string().max(50).optional(),
  spellcastingAbility: z.string().max(20).optional(),
  spellSaveDC: z.number().int().min(0).max(30).optional(),
  spellAttackBonus: z.number().int().min(-5).max(20).optional(),
  importedFromPdf: z.boolean().default(false),
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
});
export type Character = z.infer<typeof CharacterSchema>;

// ---- Adventure Setup ----
export const CampaignMode = z.enum(['one_shot', 'campaign']);
export type CampaignMode = z.infer<typeof CampaignMode>;

export const ToneOption = z.enum([
  'heroic',
  'dark',
  'comedic',
  'mystery',
  'horror',
  'political',
  'exploration',
  'action',
]);
export type ToneOption = z.infer<typeof ToneOption>;

export const AdventureOptionsSchema = z.object({
  mode: CampaignMode,
  playerCount: z.number().int().min(1).max(4),
  desiredLength: z.string().min(1).max(100),
  tones: z.array(ToneOption).min(1).max(4),
  experienceLevel: ExperienceLevel,
  settingPrompt: z.string().max(4000),
  safetyMode: z.enum(['strict', 'balanced']).default('balanced'),
});
export type AdventureOptions = z.infer<typeof AdventureOptionsSchema>;

// ---- Campaign Event Log ----
export const EventType = z.enum([
  'session_started',
  'character_created',
  'character_imported',
  'scene_opened',
  'dice_rolled',
  'npc_introduced',
  'inventory_changed',
  'quest_updated',
  'combat_started',
  'combat_round_advanced',
  'combat_ended',
  'dm_message',
  'player_message',
  'session_ended',
]);
export type EventType = z.infer<typeof EventType>;

export const CampaignEventSchema = z.object({
  id: z.string().uuid(),
  type: EventType,
  timestamp: z.number().positive(),
  payload: z.record(z.string(), z.unknown()),
});
export type CampaignEvent = z.infer<typeof CampaignEventSchema>;

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  options: AdventureOptionsSchema,
  characters: z.array(CharacterSchema),
  events: z.array(CampaignEventSchema),
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  sessionCount: z.number().int().min(0),
});
export type Campaign = z.infer<typeof CampaignSchema>;
