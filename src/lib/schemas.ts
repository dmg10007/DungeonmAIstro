import { z } from 'zod';

// ── API Key Vault ──────────────────────────────────────────────
export const LLMProvider = z.enum([
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'custom',
]);
export type LLMProvider = z.infer<typeof LLMProvider>;

export const apiKeyRecordSchema = z.object({
  provider: LLMProvider,
  label: z.string().min(1).max(50),
  encryptedKey: z.string().min(1),   // AES-GCM ciphertext, base64
  iv: z.string().min(1),             // base64 IV
  salt: z.string().min(1),           // base64 PBKDF2 salt
  expiresAt: z.number(),             // Unix ms timestamp
  createdAt: z.number(),
});
export type ApiKeyRecord = z.infer<typeof apiKeyRecordSchema>;

// ── Dice ──────────────────────────────────────────────────────
export const DiceSides = z.union([
  z.literal(4), z.literal(6), z.literal(8),
  z.literal(10), z.literal(12), z.literal(20), z.literal(100),
]);
export type DiceSides = z.infer<typeof DiceSides>;

export const diceRollRequestSchema = z.object({
  count: z.number().int().min(1).max(20).default(1),
  sides: DiceSides,
  modifier: z.number().int().min(-100).max(100).default(0),
  actorType: z.enum(['player', 'npc', 'system']).default('system'),
  actorId: z.string().optional(),
  reason: z.string().max(200).optional(),
});
export type DiceRollRequest = z.infer<typeof diceRollRequestSchema>;

export const diceRollResultSchema = z.object({
  ...diceRollRequestSchema.shape,
  rolls: z.array(z.number().int()),
  total: z.number().int(),
  timestamp: z.number(),
  id: z.string(),
});
export type DiceRollResult = z.infer<typeof diceRollResultSchema>;

// ── Character ─────────────────────────────────────────────────
export const abilityScoresSchema = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});
export type AbilityScores = z.infer<typeof abilityScoresSchema>;

export const characterSchema = z.object({
  id: z.string(),
  characterName: z.string().min(1).max(100),
  playerName: z.string().max(100).optional(),
  class: z.string().min(1).max(50),
  level: z.number().int().min(1).max(20),
  race: z.string().min(1).max(50).optional(),
  background: z.string().max(100).optional(),
  alignment: z.string().max(50).optional(),
  experiencePoints: z.number().int().min(0).optional(),
  abilityScores: abilityScoresSchema,
  proficiencyBonus: z.number().int().min(2).max(6),
  armorClass: z.number().int().min(1).max(30).optional(),
  initiative: z.number().int().optional(),
  speed: z.number().int().min(0).max(200).optional(),
  hitPointMaximum: z.number().int().min(1).max(999),
  currentHitPoints: z.number().int().min(0).max(999),
  temporaryHitPoints: z.number().int().min(0).max(999).default(0),
  deathSaves: z.object({
    successes: z.number().int().min(0).max(3).default(0),
    failures: z.number().int().min(0).max(3).default(0),
  }).default({ successes: 0, failures: 0 }),
  skills: z.record(z.string(), z.boolean()).default({}),
  savingThrows: z.record(z.string(), z.boolean()).default({}),
  equipment: z.array(z.string()).default([]),
  features: z.string().max(4000).optional(),
  notes: z.string().max(4000).optional(),
  spellcastingClass: z.string().max(50).optional(),
  spellSaveDC: z.number().int().min(1).max(30).optional(),
  spells: z.array(z.string()).default([]),
  source: z.enum(['created', 'pdf_import']).default('created'),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Character = z.infer<typeof characterSchema>;

// ── Adventure Options ─────────────────────────────────────────
export const adventureOptionsSchema = z.object({
  mode: z.enum(['one_shot', 'campaign']),
  playerCount: z.number().int().min(1).max(4),
  experienceLevel: z.enum(['new', 'intermediate', 'expert']),
  tone: z.array(z.string().min(1).max(30)).min(1).max(10),
  settingPrompt: z.string().min(1).max(2000),
  desiredLength: z.string().max(100).optional(),
  safetyMode: z.enum(['strict', 'balanced']).default('balanced'),
});
export type AdventureOptions = z.infer<typeof adventureOptionsSchema>;

// ── Campaign Event Log ────────────────────────────────────────
export const campaignEventTypeSchema = z.enum([
  'session_started',
  'session_ended',
  'character_created',
  'character_imported',
  'scene_opened',
  'dice_rolled',
  'npc_introduced',
  'inventory_changed',
  'quest_updated',
  'combat_started',
  'combat_round',
  'player_message',
  'dm_message',
  'condition_applied',
  'hp_changed',
]);
export type CampaignEventType = z.infer<typeof campaignEventTypeSchema>;

export const campaignEventSchema = z.object({
  id: z.string(),
  type: campaignEventTypeSchema,
  timestamp: z.number(),
  payload: z.record(z.string(), z.unknown()),
});
export type CampaignEvent = z.infer<typeof campaignEventSchema>;

export const campaignSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  options: adventureOptionsSchema,
  characters: z.array(characterSchema),
  events: z.array(campaignEventSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  schemaVersion: z.literal(1),
});
export type Campaign = z.infer<typeof campaignSchema>;
