import type { DieFace, DiceRollResult } from './schemas';
import { diceNotationSchema } from './schemas';

/** Roll a single die of N faces using crypto random */
export function rollDie(faces: DieFace): number {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % faces) + 1;
}

// NOTE: 100 MUST precede 10 in this alternation — regex engines are
// greedy left-to-right, so "d10" inside "d100" would match first
// if 10 were listed before 100.
const DICE_PARSE_RE = /^(\d{1,2})?d(100|4|6|8|10|12|20)([+-]\d{1,3})?$/i;

/** Parse and roll dice notation like "2d6+3", "d20", "d100", "1d8-1" */
export function roll(
  notation: string,
  actorType: DiceRollResult['actorType'] = 'system',
  actorId?: string,
  reason?: string
): DiceRollResult {
  const normalised = notation.toLowerCase().trim();
  const parsed = diceNotationSchema.safeParse(normalised);
  if (!parsed.success) throw new Error(`Invalid dice notation: ${notation}`);

  const match = normalised.match(DICE_PARSE_RE);
  if (!match) throw new Error(`Unparseable notation: ${notation}`);

  const count = parseInt(match[1] ?? '1', 10);
  const faces = parseInt(match[2], 10) as DieFace;
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  const rolls: number[] = Array.from({ length: count }, () => rollDie(faces));
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;

  return {
    notation: normalised,
    rolls,
    modifier,
    // Only apply the floor-at-1 rule for d20-system games; percentile and
    // other dice can legitimately produce 0 after a negative modifier.
    total: faces === 20 ? Math.max(total, 1) : total,
    actorType,
    actorId,
    reason,
    timestamp: new Date().toISOString(),
  };
}

/** Advantage: roll 2d20, take highest */
export function rollAdvantage(reason?: string): DiceRollResult {
  const a = rollDie(20);
  const b = rollDie(20);
  const higher = Math.max(a, b);
  return {
    notation: '2d20 advantage',
    rolls: [a, b],
    modifier: 0,
    total: higher,
    actorType: 'system',
    reason: reason ?? 'Advantage',
    timestamp: new Date().toISOString(),
  };
}

/** Disadvantage: roll 2d20, take lowest */
export function rollDisadvantage(reason?: string): DiceRollResult {
  const a = rollDie(20);
  const b = rollDie(20);
  const lower = Math.min(a, b);
  return {
    notation: '2d20 disadvantage',
    rolls: [a, b],
    modifier: 0,
    total: lower,
    actorType: 'system',
    reason: reason ?? 'Disadvantage',
    timestamp: new Date().toISOString(),
  };
}

/** Derive ability modifier from score */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Format modifier as string, e.g. +3 or -1 */
export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export const ALL_DICE: DieFace[] = [4, 6, 8, 10, 12, 20, 100];
