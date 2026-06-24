/**
 * chargen.ts — Ability score generation for D&D 5e
 *
 * Covers:
 *   - Standard Array (15, 14, 13, 12, 10, 8) with class-aware priority assignment
 *   - Point Buy (27-point budget, scores 8–15, PHB cost table)
 *   - Dice Rolls (4d6 drop lowest × 6, crypto random)
 *   - Randomize (always rolls 4d6dl, assigns by class priority, adds ASI bumps for level)
 *   - Default AC and HP by class + level
 *   - Budget validation helpers for stat-total warnings
 */

import { rollDie } from './dice';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type AbilityScores = Record<AbilityKey, number>;

export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

// ─── Standard Array ───────────────────────────────────────────────────────────

/** The canonical 5e standard array values, highest to lowest. */
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/**
 * Class priority order: abilities ranked most-to-least important.
 */
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
  priority.forEach((key, idx) => {
    scores[key] = STANDARD_ARRAY[idx] ?? 8;
  });
  return scores;
}

// ─── Point Buy ────────────────────────────────────────────────────────────────

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

// ─── Dice Rolls ───────────────────────────────────────────────────────────────

export interface SingleStatRoll {
  dice: number[];
  kept: number[];
  total: number;
}

export interface StatBlock {
  scores: number[];
  rolls: SingleStatRoll[];
}

export function rollOneStat(): SingleStatRoll {
  const dice = Array.from({ length: 4 }, () => rollDie(6));
  const sorted = [...dice].sort((a, b) => a - b);
  const kept = sorted.slice(1);
  const total = kept.reduce((a, b) => a + b, 0);
  return { dice, kept, total };
}

export function rollStatBlock(): StatBlock {
  const rolls = Array.from({ length: 6 }, () => rollOneStat());
  return { scores: rolls.map(r => r.total), rolls };
}

// ─── ASI helpers ──────────────────────────────────────────────────────────────

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

// ─── Default AC and HP by class + level ──────────────────────────────────────

/**
 * Hit die per class (d-value).
 */
const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12,
  Bard:      8,
  Cleric:    8,
  Druid:     8,
  Fighter:   10,
  Monk:      8,
  Paladin:   10,
  Ranger:    10,
  Rogue:     8,
  Sorcerer:  6,
  Warlock:   8,
  Wizard:    6,
};

/**
 * Returns the expected Max HP for a class at a given level,
 * using the standard "take average" rule:
 *   Level 1 = max die + CON mod
 *   Each subsequent level = (die/2 + 1) + CON mod
 */
export function getDefaultHP(className: string, level: number, conScore: number): number {
  const die = CLASS_HIT_DIE[className] ?? 8;
  const conMod = Math.floor((conScore - 10) / 2);
  const firstLevel = die + conMod;
  const perLevel = Math.floor(die / 2) + 1 + conMod;
  return firstLevel + perLevel * Math.max(0, level - 1);
}

/**
 * Returns a reasonable default Armor Class for a class at creation.
 * Assumes no magic items — uses the class's typical armor proficiency:
 *   - Heavy armor classes (Fighter, Paladin, Cleric): chain mail = 16
 *   - Medium armor classes (Ranger, Druid, Barbarian unarmored = 10+STR+CON mod):
 *       use 14 (scale mail) for Ranger/Druid, Barbarian unarmored formula
 *   - Light/unarmored (Rogue, Bard, Wizard, Sorcerer, Warlock, Monk):
 *       10 + DEX mod (Monk: 10 + DEX + WIS mod)
 */
export function getDefaultAC(
  className: string,
  scores: AbilityScores,
): number {
  const dexMod = Math.floor((scores.dex - 10) / 2);
  const conMod = Math.floor((scores.con - 10) / 2);
  const wisMod = Math.floor((scores.wis - 10) / 2);
  const strMod = Math.floor((scores.str - 10) / 2);
  switch (className) {
    case 'Fighter':
    case 'Paladin':
      return 16; // chain mail
    case 'Cleric':
      return 16; // chain mail (most clerics)
    case 'Ranger':
    case 'Druid':
      return 14 + Math.min(dexMod, 2); // scale mail (medium, +DEX max 2)
    case 'Barbarian':
      return 10 + dexMod + conMod; // Unarmored Defense
    case 'Monk':
      return 10 + dexMod + wisMod; // Unarmored Defense
    case 'Rogue':
    case 'Bard':
      return 11 + dexMod; // leather armor
    case 'Sorcerer':
    case 'Wizard':
    case 'Warlock':
    default:
      return 10 + dexMod; // no armor
  }
}

// ─── Randomize ────────────────────────────────────────────────────────────────

export type StatMethod = 'standard_array' | 'point_buy' | 'dice_rolls';

export interface RandomizeResult {
  scores: AbilityScores;
  method: StatMethod;
  detail: string;
  ac: number;
  hp: number;
}

/**
 * Randomize: always rolls 4d6 drop lowest × 6, assigns values in
 * class-priority order, applies ASI bumps for the character's level,
 * then derives default AC and HP from the resulting scores.
 */
export function randomizeStatBlock(className: string, level = 1): RandomizeResult {
  const block = rollStatBlock();
  const sorted = [...block.scores].sort((a, b) => b - a);
  const priority = CLASS_PRIORITY[className] ?? DEFAULT_PRIORITY;

  const base = emptyScores(8);
  priority.forEach((key, idx) => {
    base[key] = sorted[idx] ?? 8;
  });

  const asiCount = getAsiCount(className, level);
  const scores = applyAsis(base, className, asiCount);

  const ac = getDefaultAC(className, scores);
  const hp = getDefaultHP(className, level, scores.con);

  const rollSummary = block.rolls.map(r => `[${r.dice.join(',')}]→${r.total}`).join(' ');
  const asiNote = asiCount > 0 ? ` + ${asiCount} ASI${asiCount > 1 ? 's' : ''} applied` : '';

  return {
    scores,
    method: 'dice_rolls',
    detail: `4d6 drop lowest${asiNote}: ${rollSummary}`,
    ac,
    hp,
  };
}

// ─── Budget Validation ────────────────────────────────────────────────────────

export function getExpectedStatBudget(level: number): number {
  const asiCount = Math.floor(level / 4);
  return 72 + asiCount * 2;
}

export function getStatBudgetWarning(scores: AbilityScores, level: number): string | null {
  const total = ABILITY_KEYS.reduce((sum, k) => sum + scores[k], 0);
  const expected = getExpectedStatBudget(level);
  if (total > expected + 20) {
    return `Stat total (${total}) is unusually high for level ${level} — double-check for errors.`;
  }
  if (total < expected - 20) {
    return `Stat total (${total}) is unusually low for level ${level} — consider reviewing your scores.`;
  }
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function emptyScores(fill: number): AbilityScores {
  return { str: fill, dex: fill, con: fill, int: fill, wis: fill, cha: fill };
}

function cryptoRandFloat(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 0x100000000;
}
void cryptoRandFloat;
