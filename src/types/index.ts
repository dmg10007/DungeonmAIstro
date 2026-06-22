// ─── Dice ────────────────────────────────────────────────────────────────────
export type DieSize = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export interface DiceRoll {
  id: string;
  die: DieSize;
  count: number;
  modifier: number;
  results: number[];
  total: number;
  label?: string;
  rolledAt: number;
  rolledBy: 'player' | 'dm' | 'npc';
}

// ─── Character ───────────────────────────────────────────────────────────────
export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface Character {
  id: string;
  name: string;
  race: string;
  subrace?: string;
  class: string;
  subclass?: string;
  level: number;
  background: string;
  alignment: string;
  experiencePoints: number;
  abilityScores: AbilityScores;
  hitPoints: { current: number; maximum: number; temporary: number };
  armorClass: number;
  initiative: number;
  speed: number;
  proficiencyBonus: number;
  savingThrows: Partial<Record<keyof AbilityScores, boolean>>;
  skills: Record<string, boolean>;
  features: string[];
  equipment: string[];
  spells?: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Campaign ────────────────────────────────────────────────────────────────
export type CampaignLength = 'one-shot' | 'short' | 'standard' | 'epic';
export type Tone = 'heroic' | 'dark' | 'comedic' | 'mystery' | 'horror' | 'custom';

export interface CampaignSetup {
  title: string;
  prompt: string;
  length: CampaignLength;
  tone: Tone;
  playerCount: number;
  startingLevel: number;
  allowedSources: string[];
  customPrompt?: string;
}

export interface Campaign {
  id: string;
  setup: CampaignSetup;
  summary: string;
  currentAct: number;
  totalActs: number;
  createdAt: number;
  updatedAt: number;
}

// ─── Session / Messages ──────────────────────────────────────────────────────
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  campaignId: string;
  sessionNumber: number;
  messages: Message[];
  rollLog: DiceRoll[];
  startedAt: number;
  lastActiveAt: number;
}

// ─── LLM Config ──────────────────────────────────────────────────────────────
export type LLMProvider = 'openai' | 'anthropic' | 'google';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  label: string;
  maxTokens: number;
  temperature: number;
}
