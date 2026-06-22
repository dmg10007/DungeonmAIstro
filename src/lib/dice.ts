/**
 * Dice Engine
 * Supports d4, d6, d8, d10, d12, d20, d100.
 * Uses crypto.getRandomValues for unbiased results.
 */
import { type DiceRollRequest, type DiceRollResult, type DiceSides } from './schemas';

const VALID_SIDES: DiceSides[] = [4, 6, 8, 10, 12, 20, 100];

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Roll a single die using crypto.getRandomValues for uniform distribution. */
function rollOne(sides: DiceSides): number {
  const max = sides;
  // Rejection sampling to eliminate modulo bias
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let val: number;
  do {
    crypto.getRandomValues(buf);
    val = buf[0];
  } while (val >= limit);
  return (val % max) + 1;
}

/** Roll dice according to a DiceRollRequest. */
export function rollDice(req: DiceRollRequest): DiceRollResult {
  const rolls: number[] = [];
  const count = req.count ?? 1;
  for (let i = 0; i < count; i++) {
    rolls.push(rollOne(req.sides));
  }
  const sum = rolls.reduce((a, b) => a + b, 0);
  const modifier = req.modifier ?? 0;
  return {
    ...req,
    count,
    modifier,
    rolls,
    total: sum + modifier,
    timestamp: Date.now(),
    id: generateId(),
  };
}

/** Parse a dice notation string like "2d6+3" into a DiceRollRequest. */
export function parseNotation(
  notation: string,
  actorType: DiceRollRequest['actorType'] = 'system',
): DiceRollRequest | null {
  const match = notation.trim().match(/^(\d{1,2})?d(\d+)([+-]\d{1,3})?$/i);
  if (!match) return null;

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (!VALID_SIDES.includes(sides as DiceSides)) return null;
  if (count < 1 || count > 20) return null;

  return { count, sides: sides as DiceSides, modifier, actorType };
}

/** Get the ability score modifier per 5e rules: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Format a modifier as a signed string: +3 or -1. */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export { VALID_SIDES };
