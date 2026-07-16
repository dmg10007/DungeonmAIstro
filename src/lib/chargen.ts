/**
 * chargen.ts — Ability score generation helpers.
 *
 * Covers:
 *   - Standard Array (15, 14, 13, 12, 10, 8) with class-aware priority
 *   - Point Buy (27-point budget, scores 8–15, PHB cost table)
 *   - Dice Rolls (4d6 drop lowest × 6, crypto random)
 *   - Randomize (4d6dl, class priority, level ASIs, derive AC/HP)
 *   - Weighted Randomize (biased stat profiles)
 *   - Default AC and HP by class + level
 *   - Budget validation helpers
 */

import { rollDie } from './dice';

// ── Types ────────────────────────────────────────────────────────────

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type AbilityScores = Record<AbilityKey, number>;
export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

// ── Weight Profiles ───────────────────────────────────────────────────────

/**
 * A WeightProfile is a partial override of stat priority.
 * Keys present in `priority` are placed first (in order), then the
 * class's natural priority fills the rest. The `label` is shown in UI.
 *
 * `rerollThreshold` (optional): discard and reroll any single die total
 * below this value, up to 3 retries. Default 0 (no reroll).
 */
export interface WeightProfile {
  id: string;
  label: string;
  description: string;
  /** Abilities to favour, in order. Class priority fills unspecified slots. */
  priority: AbilityKey[];
  /** Reroll individual stat if below this value (0 = off). */
  rerollThreshold: number;
}

export const WEIGHT_PROFILES: WeightProfile[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Pure class priority — no bias.',
    priority: [],
    rerollThreshold: 0,
  },
  {
    id: 'tanky',
    label: 'Tanky',
    description: 'Prioritise CON and STR. Great for Fighters, Barbarians, Paladins.',
    priority: ['con', 'str', 'dex'],
    rerollThreshold: 8,
  },
  {
    id: 'stealthy',
    label: 'Stealthy',
    description: 'Prioritise DEX and INT. Great for Rogues and Rangers.',
    priority: ['dex', 'int', 'con'],
    rerollThreshold: 8,
  },
  {
    id: 'arcane',
    label: 'Arcane',
    description: 'Prioritise INT and CON. Great for Wizards and Artificers.',
    priority: ['int', 'con', 'dex'],
    rerollThreshold: 9,
  },
  {
    id: 'divine',
    label: 'Divine',
    description: 'Prioritise WIS and CHA. Great for Clerics, Druids, Bards.',
    priority: ['wis', 'cha', 'con'],
    rerollThreshold: 9,
  },
  {
    id: 'brutish',
    label: 'Brutish',
    description: 'Max STR, ignore CHA. Pure melee damage dealer.',
    priority: ['str', 'con', 'dex', 'wis', 'int', 'cha'],
    rerollThreshold: 10,
  },
];

// ── Standard Array ────────────────────────────────────────────────────────

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

const CLASS_PRIORITY: Record<string, AbilityKey[]> = {
  Barbarian:  ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  Bard:       ['cha', 'dex', 'con', 'wis', 'int', 'str'],
  Cleric:     ['wis', 'con', 'str', 'cha', 'int', 'dex'],
  Druid:      ['wis', 'con', 'dex', 'int', 'cha', 'str'],
  Fighter:    ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  Monk:       ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  Paladin:    ['str', 'cha', 'con', 'wis', 'dex', 'int'],
  Ranger:     ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  Rogue:      ['dex', 'cha', 'con', 'int', 'wis', 'str'],
  Sorcerer:   ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  Warlock:    ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  Wizard:     ['int', 'con', 'dex', 'wis', 'cha', 'str'],
};

const DEFAULT_PRIORITY: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function getStandardArrayScores(className: string): AbilityScores {
  const priority = CLASS_PRIORITY[className] ?? DEFAULT_PRIORITY;
  const scores = emptyScores(0);
  priority.forEach((key, idx) => { scores[key] = STANDARD_ARRAY[idx] ?? 8; });
  return scores;
}

// ── Point Buy ────────────────────────────────────────────────────────────

const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

export function getPointBuySpent(scores: AbilityScores): number {
  return ABILITY_KEYS.reduce((total, key) => {
    const score = Math.min(Math.max(scores[key], 8), 15);
    return total + (POINT_BUY_COSTS[score] ?? 0);
  }, 0);
}

export function getPointBuyCost(score: number): number | null {
  return POINT_BUY_COSTS[score] ?? null;
}

// ── Dice Rolls ────────────────────────────────────────────────────────────

export interface SingleStatRoll {
  dice: number[];
  kept: number[];
  total: number;
}

export interface StatBlock {
  scores: number[];
  rolls: SingleStatRoll[];
}

export function rollOneStat(rerollBelow = 0, maxRetries = 3): SingleStatRoll {
  let result: SingleStatRoll;
  let tries = 0;
  do {
    const dice = Array.from({ length: 4 }, () => rollDie(6));
    const sorted = [...dice].sort((a, b) => a - b);
    const kept = sorted.slice(1);
    const total = kept.reduce((a, b) => a + b, 0);
    result = { dice, kept, total };
    tries++;
  } while (result.total < rerollBelow && tries <= maxRetries);
  return result!;
}

export function rollStatBlock(rerollBelow = 0): StatBlock {
  const rolls = Array.from({ length: 6 }, () => rollOneStat(rerollBelow));
  return { scores: rolls.map(r => r.total), rolls };
}

// ── ASI helpers ────────────────────────────────────────────────────────────

const CLASS_ASI_LEVELS: Record<string, number[]> = {
  Barbarian: [4, 8, 12, 16, 19],
  Bard:      [4, 8, 12, 16, 19],
  Cleric:    [4, 8, 12, 16, 19],
  Druid:     [4, 8, 12, 16, 19],
  Fighter:   [4, 6, 8, 12, 14, 16, 19],
  Monk:      [4, 8, 12, 16, 19],
  Paladin:   [4, 8, 12, 16, 19],
  Ranger:    [4, 8, 12, 16, 19],
  Rogue:     [4, 8, 10, 12, 16, 19],
  Sorcerer:  [4, 8, 12, 16, 19],
  Warlock:   [4, 8, 12, 16, 19],
  Wizard:    [4, 8, 12, 16, 19],
};

export function getAsiCount(className: string, level: number): number {
  const levels = CLASS_ASI_LEVELS[className] ?? CLASS_ASI_LEVELS['Barbarian'];
  return levels.filter(l => l <= level).length;
}

function applyAsis(scores: AbilityScores, className: string, asiCount: number): AbilityScores {
  if (asiCount === 0) return scores;
  const result = { ...scores };
  const priority = CLASS_PRIORITY[className] ?? DEFAULT_PRIORITY;
  let remaining = asiCount * 2;
  for (const key of priority) {
    if (remaining <= 0) break;
    const room = 20 - result[key];
    if (room <= 0) continue;
    const bump = Math.min(remaining, room);
    result[key] = result[key] + bump;
    remaining -= bump;
  }
  return result;
}

// ── Default AC and HP ────────────────────────────────────────────────────────

const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12, Bard: 8, Cleric: 8, Druid: 8, Fighter: 10,
  Monk: 8, Paladin: 10, Ranger: 10, Rogue: 8, Sorcerer: 6, Warlock: 8, Wizard: 6,
};

export function getDefaultHP(className: string, level: number, conScore: number): number {
  const die = CLASS_HIT_DIE[className] ?? 8;
  const conMod = Math.floor((conScore - 10) / 2);
  const firstLevel = die + conMod;
  const perLevel = Math.floor(die / 2) + 1 + conMod;
  return firstLevel + perLevel * Math.max(0, level - 1);
}

export function getDefaultAC(className: string, scores: AbilityScores): number {
  const dexMod = Math.floor((scores.dex - 10) / 2);
  const conMod = Math.floor((scores.con - 10) / 2);
  const wisMod = Math.floor((scores.wis - 10) / 2);
  switch (className) {
    case 'Fighter': case 'Paladin': case 'Cleric': return 16;
    case 'Ranger': case 'Druid': return 14 + Math.min(dexMod, 2);
    case 'Barbarian': return 10 + dexMod + conMod;
    case 'Monk': return 10 + dexMod + wisMod;
    case 'Rogue': case 'Bard': return 11 + dexMod;
    default: return 10 + dexMod;
  }
}

// ── Randomize ────────────────────────────────────────────────────────────

export type StatMethod = 'standard_array' | 'point_buy' | 'dice_rolls';

export interface RandomizeResult {
  scores: AbilityScores;
  method: StatMethod;
  detail: string;
  ac: number;
  hp: number;
}

/**
 * Build the effective priority order for a given class + weight profile.
 * Profile priority keys come first; class priority fills any remaining slots
 * (deduped). This means profile keys that match the class priority simply
 * move those stats earlier — class identity is always preserved.
 */
function buildEffectivePriority(
  className: string,
  profile: WeightProfile,
): AbilityKey[] {
  const classPriority = CLASS_PRIORITY[className] ?? DEFAULT_PRIORITY;
  if (profile.priority.length === 0) return classPriority;
  const seen = new Set<AbilityKey>(profile.priority);
  const rest = classPriority.filter(k => !seen.has(k));
  return [...profile.priority, ...rest];
}

/**
 * Classic randomize: 4d6 drop lowest, class priority assignment, level ASIs.
 * Exposed for backwards compat — internally delegates to weightedRandomize
 * with the Balanced profile.
 */
export function randomizeStatBlock(className: string, level = 1): RandomizeResult {
  return weightedRandomize(className, level, WEIGHT_PROFILES[0]);
}

/**
 * Weighted randomize: 4d6dl with optional per-stat reroll threshold,
 * assigns highest rolls to the effective priority order (profile overrides
 * class priority), then applies level ASIs and derives AC/HP.
 */
export function weightedRandomize(
  className: string,
  level = 1,
  profile: WeightProfile = WEIGHT_PROFILES[0],
): RandomizeResult {
  const block = rollStatBlock(profile.rerollThreshold);
  const sorted = [...block.scores].sort((a, b) => b - a);
  const priority = buildEffectivePriority(className, profile);

  const base = emptyScores(8);
  priority.forEach((key, idx) => { base[key] = sorted[idx] ?? 8; });

  const asiCount = getAsiCount(className, level);
  const scores = applyAsis(base, className, asiCount);
  const ac = getDefaultAC(className, scores);
  const hp = getDefaultHP(className, level, scores.con);

  const rollSummary = block.rolls.map(r => `[${r.dice.join(',')}]\u2192${r.total}`).join(' ');
  const asiNote = asiCount > 0 ? ` + ${asiCount} ASI${asiCount > 1 ? 's' : ''}` : '';
  const profileNote = profile.id !== 'balanced' ? ` [${profile.label}]` : '';
  const rerollNote = profile.rerollThreshold > 0 ? ` (reroll<${profile.rerollThreshold})` : '';

  return {
    scores,
    method: 'dice_rolls',
    detail: `4d6dl${profileNote}${rerollNote}${asiNote}: ${rollSummary}`,
    ac,
    hp,
  };
}

// ── Budget Validation ────────────────────────────────────────────────────────

export function getExpectedStatBudget(level: number): number {
  return 72 + Math.floor(level / 4) * 2;
}

export function getStatBudgetWarning(scores: AbilityScores, level: number): string | null {
  const total = ABILITY_KEYS.reduce((sum, k) => sum + scores[k], 0);
  const expected = getExpectedStatBudget(level);
  if (total > expected + 20) return `Stat total (${total}) is unusually high for level ${level}.`;
  if (total < expected - 20) return `Stat total (${total}) is unusually low for level ${level}.`;
  return null;
}

// ── Helpers ────────────────────────────────────────────────────────────

export function emptyScores(fill: number): AbilityScores {
  return { str: fill, dex: fill, con: fill, int: fill, wis: fill, cha: fill };
}
