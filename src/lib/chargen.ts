/**
 * chargen.ts — Ability score generation for D&D 5e
 *
 * Covers:
 *   - Standard Array (15, 14, 13, 12, 10, 8) with class-aware priority assignment
 *   - Point Buy (27-point budget, scores 8–15, PHB cost table)
 *   - Dice Rolls (4d6 drop lowest × 6, crypto random)
 *   - Randomize (always rolls 4d6dl, assigns by class priority, adds ASI bumps for level)
 *   - Budget validation helpers for stat-total warnings
 */

import { rollDie } from './dice';

// ─── Types ───────────────────────────────────────────────────────────────────────────────

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type AbilityScores = Record<AbilityKey, number>;

export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

// ─── Standard Array ───────────────────────────────────────────────────────────────────

/** The canonical 5e standard array values, highest to lowest. */
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/**
 * Class priority order: abilities ranked most-to-least important.
 * The standard array values are assigned in this order so the
 * highest value lands on the primary stat for the chosen class.
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

/**
 * Returns ability scores built from the standard array,
 * assigned in class-priority order.
 */
export function getStandardArrayScores(className: string): AbilityScores {
  const priority = CLASS_PRIORITY[className] ?? DEFAULT_PRIORITY;
  const scores = emptyScores(0);
  priority.forEach((key, idx) => {
    scores[key] = STANDARD_ARRAY[idx] ?? 8;
  });
  return scores;
}

// ─── Point Buy ────────────────────────────────────────────────────────────────────────

/**
 * PHB point buy cost table.
 * Score 8 costs 0; each step up costs 1 more (scores 14–15 cost 2 each).
 * Valid range for point buy: 8–15.
 */
const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

/** Total points spent across all ability scores. */
export function getPointBuySpent(scores: AbilityScores): number {
  return ABILITY_KEYS.reduce((total, key) => {
    const score = Math.min(Math.max(scores[key], 8), 15);
    return total + (POINT_BUY_COSTS[score] ?? 0);
  }, 0);
}

/** Returns the point buy cost for a single score, or null if out of range. */
export function getPointBuyCost(score: number): number | null {
  return POINT_BUY_COSTS[score] ?? null;
}

// ─── Dice Rolls ─────────────────────────────────────────────────────────────────────

export interface SingleStatRoll {
  /** All four d6 values rolled. */
  dice: number[];
  /** The three kept (highest) dice. */
  kept: number[];
  /** Sum of the three kept dice. */
  total: number;
}

export interface StatBlock {
  /** Six stat totals in roll order (not yet assigned to abilities). */
  scores: number[];
  /** Full breakdown per roll. */
  rolls: SingleStatRoll[];
}

/** Roll 4d6, drop the lowest die — the standard 5e stat-rolling method. */
export function rollOneStat(): SingleStatRoll {
  const dice = Array.from({ length: 4 }, () => rollDie(6));
  const sorted = [...dice].sort((a, b) => a - b);
  const kept = sorted.slice(1); // drop lowest
  const total = kept.reduce((a, b) => a + b, 0);
  return { dice, kept, total };
}

/** Roll a full stat block: 4d6 drop lowest, six times. */
export function rollStatBlock(): StatBlock {
  const rolls = Array.from({ length: 6 }, () => rollOneStat());
  return {
    scores: rolls.map(r => r.total),
    rolls,
  };
}

// ─── ASI helpers ─────────────────────────────────────────────────────────────────────

/**
 * Per-class ASI levels (levels at which the class gains an ASI or feat).
 * Fighter and Rogue get extras per PHB.
 */
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

/**
 * Returns the number of ASIs earned up to (and including) the given level
 * for the given class.
 */
export function getAsiCount(className: string, level: number): number {
  const levels = CLASS_ASI_LEVELS[className] ?? CLASS_ASI_LEVELS['Barbarian'];
  return levels.filter(l => l <= level).length;
}

/**
 * Apply `asiCount` × 2-point bumps to the top-priority abilities, capped at 20.
 * Each ASI gives +2 to the single highest-priority stat that isn’t already 20,
 * simulating the most common optimised choice.
 */
function applyAsis(scores: AbilityScores, className: string, asiCount: number): AbilityScores {
  if (asiCount === 0) return scores;
  const result = { ...scores };
  const priority = CLASS_PRIORITY[className] ?? DEFAULT_PRIORITY;
  let remaining = asiCount * 2;
  // Distribute +2 per ASI into the primary stat, then secondary, etc.
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

// ─── Randomize ────────────────────────────────────────────────────────────────────────

export type StatMethod = 'standard_array' | 'point_buy' | 'dice_rolls';

export interface RandomizeResult {
  scores: AbilityScores;
  method: StatMethod;
  detail: string;
}

/**
 * Randomize: always rolls 4d6 drop lowest × 6, assigns values in
 * class-priority order, then applies ASI bumps for the character’s level.
 *
 * This gives a genuinely randomised but level-appropriate stat block
 * every time the button is clicked — no method randomisation.
 */
export function randomizeStatBlock(className: string, level = 1): RandomizeResult {
  const block = rollStatBlock();
  const sorted = [...block.scores].sort((a, b) => b - a);
  const priority = CLASS_PRIORITY[className] ?? DEFAULT_PRIORITY;

  // Assign highest rolled value to highest-priority ability
  const base = emptyScores(8);
  priority.forEach((key, idx) => {
    base[key] = sorted[idx] ?? 8;
  });

  // Apply ASI bonuses earned at this level
  const asiCount = getAsiCount(className, level);
  const scores = applyAsis(base, className, asiCount);

  const rollSummary = block.rolls.map(r => `[${r.dice.join(',')}]→${r.total}`).join(' ');
  const asiNote = asiCount > 0 ? ` + ${asiCount} ASI${asiCount > 1 ? 's' : ''} applied` : '';

  return {
    scores,
    method: 'dice_rolls',
    detail: `4d6 drop lowest${asiNote}: ${rollSummary}`,
  };
}

// ─── Budget Validation ────────────────────────────────────────────────────────────────────

/**
 * Returns an approximate expected total ability score budget for a given level.
 * Standard array total = 72; point buy avg ≈ 75; rolled avg ≈ 73.
 * Higher levels often have ASIs applied, raising the budget.
 */
export function getExpectedStatBudget(level: number): number {
  const asiCount = Math.floor(level / 4); // rough ASI count (class-agnostic)
  return 72 + asiCount * 2;
}

/**
 * Returns a warning string if the stat total looks significantly off
 * for the given level, or null if it looks reasonable.
 */
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

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────

/** Create a zeroed (or seeded) AbilityScores object. */
export function emptyScores(fill: number): AbilityScores {
  return { str: fill, dex: fill, con: fill, int: fill, wis: fill, cha: fill };
}

/** Crypto-safe float in [0, 1). */
function cryptoRandFloat(): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / 0x100000000;
}

// Keep cryptoRandFloat used (point buy path still available via rollStatBlock consumers)
void cryptoRandFloat;
