/**
 * chargen.ts — Ability score generation for D&D 5e
 *
 * Covers:
 *   - Standard Array (15, 14, 13, 12, 10, 8) with class-aware priority assignment
 *   - Point Buy (27-point budget, scores 8–15, PHB cost table)
 *   - Dice Rolls (4d6 drop lowest × 6, crypto random)
 *   - Randomize (randomly selects a method and assigns scores)
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

// ─── Point Buy ────────────────────────────────────────────────────────────────

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

// ─── Dice Rolls ───────────────────────────────────────────────────────────────

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

// ─── Randomize ────────────────────────────────────────────────────────────────

export type StatMethod = 'standard_array' | 'point_buy' | 'dice_rolls';

export interface RandomizeResult {
  scores: AbilityScores;
  method: StatMethod;
  detail: string;
}

/**
 * Randomly picks a stat method, generates scores, and assigns them
 * using class-priority order.
 *
 * Weights: standard_array 40%, dice_rolls 40%, point_buy 20%
 * (point_buy is less common because randomised point buy is unusual at real tables).
 */
export function randomizeStatBlock(className: string): RandomizeResult {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const roll = arr[0] % 10; // 0–9

  if (roll < 4) {
    // Standard array
    const scores = getStandardArrayScores(className);
    return {
      scores,
      method: 'standard_array',
      detail: `Standard array assigned for ${className}: ${STANDARD_ARRAY.join(', ')}`,
    };
  }

  if (roll < 6) {
    // Random point buy — distribute 27 points randomly within valid range
    const scores = emptyScores(8);
    let budget = 27;
    const keys = [...ABILITY_KEYS].sort(() => cryptoRandFloat() - 0.5);
    for (const key of keys) {
      const maxAffordable = Object.entries(POINT_BUY_COSTS)
        .filter(([, cost]) => cost <= budget)
        .map(([score]) => parseInt(score, 10));
      const pick = maxAffordable[Math.floor(cryptoRandFloat() * maxAffordable.length)] ?? 8;
      scores[key] = pick;
      budget -= POINT_BUY_COSTS[pick] ?? 0;
    }
    return {
      scores,
      method: 'point_buy',
      detail: `Random point buy (${27 - budget} of 27 points spent)`,
    };
  }

  // Dice rolls — roll, then assign highest to class-primary stat
  const block = rollStatBlock();
  const sorted = [...block.scores].sort((a, b) => b - a);
  const priority = CLASS_PRIORITY[className] ?? DEFAULT_PRIORITY;
  const scores = emptyScores(8);
  priority.forEach((key, idx) => {
    scores[key] = sorted[idx] ?? 8;
  });
  const rollSummary = block.rolls.map(r => `[${r.dice.join(',')}]→${r.total}`).join(' ');
  return {
    scores,
    method: 'dice_rolls',
    detail: rollSummary,
  };
}

// ─── Budget Validation ────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
