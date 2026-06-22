/**
 * Dice Engine
 * Supports all D&D 5e dice: d4, d6, d8, d10, d12, d20, d100
 * Uses crypto.getRandomValues for unbiased rolls.
 */

import type { DieFace, DiceRollResult } from './schemas';
import { DiceNotationSchema } from './schemas';

const VALID_FACES: DieFace[] = [4, 6, 8, 10, 12, 20, 100];

/** Roll a single die of n sides using a cryptographically random source. */
export function rollDie(sides: DieFace): number {
  // Rejection sampling to eliminate modulo bias
  const limit = Math.floor(0x100000000 / sides) * sides;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return (value % sides) + 1;
}

/** Parse dice notation like "2d6+3" into parts. */
export function parseNotation(notation: string): {
  count: number;
  sides: DieFace;
  modifier: number;
} {
  DiceNotationSchema.parse(notation); // throws if invalid
  const match = notation
    .toLowerCase()
    .match(/^(\d+)?d(\d+)([+-]\d+)?$/);
  if (!match) throw new Error(`Unparseable notation: ${notation}`);

  const count = parseInt(match[1] ?? '1', 10);
  const sides = parseInt(match[2], 10) as DieFace;
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (!VALID_FACES.includes(sides)) {
    throw new Error(`Invalid die face: d${sides}. Must be one of ${VALID_FACES.join(', ')}`);
  }

  return { count, sides, modifier };
}

/**
 * Roll dice by notation string.
 * Returns full result including individual rolls, modifier, and total.
 */
export function roll(
  notation: string,
  opts?: {
    actorType?: DiceRollResult['actorType'];
    actorId?: string;
    reason?: string;
    advantage?: boolean;
    disadvantage?: boolean;
  },
): DiceRollResult {
  const { count, sides, modifier } = parseNotation(notation);

  let rolls: number[];

  if ((opts?.advantage || opts?.disadvantage) && count === 1 && sides === 20) {
    // Advantage/Disadvantage: roll twice, take highest or lowest
    const r1 = rollDie(sides);
    const r2 = rollDie(sides);
    rolls = opts.advantage ? [Math.max(r1, r2)] : [Math.min(r1, r2)];
  } else {
    rolls = Array.from({ length: count }, () => rollDie(sides));
  }

  const total = rolls.reduce((a, b) => a + b, 0) + modifier;

  return {
    notation,
    rolls,
    modifier,
    total,
    actorType: opts?.actorType ?? 'system',
    actorId: opts?.actorId,
    reason: opts?.reason,
    timestamp: Date.now(),
  };
}

/** Shorthand helpers */
export const d4  = (opts?: Parameters<typeof roll>[1]) => roll('d4',  opts);
export const d6  = (opts?: Parameters<typeof roll>[1]) => roll('d6',  opts);
export const d8  = (opts?: Parameters<typeof roll>[1]) => roll('d8',  opts);
export const d10 = (opts?: Parameters<typeof roll>[1]) => roll('d10', opts);
export const d12 = (opts?: Parameters<typeof roll>[1]) => roll('d12', opts);
export const d20 = (opts?: Parameters<typeof roll>[1]) => roll('d20', opts);
export const d100= (opts?: Parameters<typeof roll>[1]) => roll('d100',opts);

/** Roll 4d6, drop lowest — standard ability score generation. */
export function rollAbilityScore(): { rolls: number[]; dropped: number; result: number } {
  const rolls = Array.from({ length: 4 }, () => rollDie(6));
  const sorted = [...rolls].sort((a, b) => a - b);
  const dropped = sorted[0];
  const result = sorted.slice(1).reduce((a, b) => a + b, 0);
  return { rolls, dropped, result };
}

/** Calculate standard D&D 5e ability modifier. */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Calculate proficiency bonus for a given character level. */
export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}
