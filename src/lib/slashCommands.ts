/**
 * Slash command parser for the Play page chat input.
 *
 * Supported forms (case-insensitive):
 *
 *   Generic dice rolls (all rulesets)
 *     /roll d20            → d20
 *     /r 2d6+3 fire damage → 2d6+3, reason="fire damage"
 *     /roll d100           → d100   (CoC, SR — note: 100 before 10 in regex)
 *     /roll d%             → d100 alias (CoC percentile shorthand)
 *
 *   Advantage / disadvantage (D&D 5e / PF2e)
 *     /adv perception      → 2d20kh1, reason="perception"
 *     /dis stealth         → 2d20kl1, reason="stealth"
 *     /advantage ...
 *     /disadvantage ...
 *
 *   CoC 7e skill / stat shortcuts
 *     /skill 60            → d100 ≤ 60 = pass
 *     /luck 50             → d100 vs Luck 50
 *     /san 45              → d100 vs Sanity 45
 *     /push                → d100 "Pushed roll"
 *
 *   Shadowrun 6e dice pool
 *     /pool 8              → 8d6 dice pool (count 5s and 6s)
 *     /pool 8 dodge        → 8d6 "dodge"
 *
 *   Pathfinder 2e
 *     /flat N              → d20, reason="Flat check DC N"
 *
 * Returns a ParsedSlashCommand on success, null if text is not a slash command.
 */

export interface ParsedSlashRoll {
  type: 'roll';
  notation: string;
  reason: string;
  advantage: boolean;
  disadvantage: boolean;
  /** SR6e only: if true, caller should count hits (5s and 6s) in the roll result */
  isDicePool: boolean;
  /** CoC / PF2e: if set, caller should compare total ≤ threshold for pass/fail */
  skillThreshold?: number;
}

export type ParsedSlashCommand = ParsedSlashRoll;

// 100 before 10 — longest match must win
const NOTATION_RE = /^(\d{1,2})?d(100|4|6|8|10|12|20)([+-]\d{1,3})?/i;

const ROLL_CMD  = /^\/(?:roll|r)\s+(.*)/i;
const ADV_CMD   = /^\/adv(?:antage)?\s*(.*)/i;
const DIS_CMD   = /^\/dis(?:advantage)?\s*(.*)/i;
const SKILL_CMD = /^\/(?:skill|coc)\s+(\d+)\s*(.*)/i;
const LUCK_CMD  = /^\/luck\s+(\d+)\s*(.*)/i;
const SAN_CMD   = /^\/san(?:ity)?\s+(\d+)\s*(.*)/i;
const PUSH_CMD  = /^\/push\s*(.*)/i;
const POOL_CMD  = /^\/(?:pool|dp)\s+(\d+)\s*(.*)/i;
const FLAT_CMD  = /^\/flat\s+(\d+)\s*(.*)/i;

export function parseSlashCommand(text: string): ParsedSlashCommand | null {
  const t = text.trim();
  if (!t.startsWith('/')) return null;

  // --- advantage / disadvantage ---
  const advM = t.match(ADV_CMD);
  if (advM) return { type: 'roll', notation: 'd20', reason: advM[1].trim() || 'Advantage', advantage: true, disadvantage: false, isDicePool: false };

  const disM = t.match(DIS_CMD);
  if (disM) return { type: 'roll', notation: 'd20', reason: disM[1].trim() || 'Disadvantage', advantage: false, disadvantage: true, isDicePool: false };

  // --- CoC shortcuts ---
  const skillM = t.match(SKILL_CMD);
  if (skillM) {
    const threshold = parseInt(skillM[1], 10);
    const reason = skillM[2].trim() || `Skill check (threshold ${threshold})`;
    return { type: 'roll', notation: 'd100', reason, advantage: false, disadvantage: false, isDicePool: false, skillThreshold: threshold };
  }

  const luckM = t.match(LUCK_CMD);
  if (luckM) {
    const threshold = parseInt(luckM[1], 10);
    const reason = luckM[2].trim() || `Luck check (${threshold})`;
    return { type: 'roll', notation: 'd100', reason, advantage: false, disadvantage: false, isDicePool: false, skillThreshold: threshold };
  }

  const sanM = t.match(SAN_CMD);
  if (sanM) {
    const threshold = parseInt(sanM[1], 10);
    const reason = sanM[2].trim() || `Sanity check (${threshold})`;
    return { type: 'roll', notation: 'd100', reason, advantage: false, disadvantage: false, isDicePool: false, skillThreshold: threshold };
  }

  const pushM = t.match(PUSH_CMD);
  if (pushM) {
    const reason = pushM[1].trim() || 'Pushed roll';
    return { type: 'roll', notation: 'd100', reason, advantage: false, disadvantage: false, isDicePool: false };
  }

  // --- Shadowrun dice pool ---
  const poolM = t.match(POOL_CMD);
  if (poolM) {
    const count = Math.min(parseInt(poolM[1], 10), 30); // safety cap
    const reason = poolM[2].trim() || `${count}-die pool`;
    return { type: 'roll', notation: `${count}d6`, reason, advantage: false, disadvantage: false, isDicePool: true };
  }

  // --- PF2e flat check ---
  const flatM = t.match(FLAT_CMD);
  if (flatM) {
    const dc = parseInt(flatM[1], 10);
    const reason = flatM[2].trim() || `Flat check DC ${dc}`;
    return { type: 'roll', notation: 'd20', reason, advantage: false, disadvantage: false, isDicePool: false, skillThreshold: dc };
  }

  // --- generic /roll or /r ---
  const rollM = t.match(ROLL_CMD);
  if (!rollM) return null;

  let rest = rollM[1].trim();

  // /roll adv ... and /roll dis ... shorthand inside /roll
  if (/^adv(?:antage)?\s*/i.test(rest)) {
    const reason = rest.replace(/^adv(?:antage)?\s*/i, '').trim();
    return { type: 'roll', notation: 'd20', reason: reason || 'Advantage', advantage: true, disadvantage: false, isDicePool: false };
  }
  if (/^dis(?:advantage)?\s*/i.test(rest)) {
    const reason = rest.replace(/^dis(?:advantage)?\s*/i, '').trim();
    return { type: 'roll', notation: 'd20', reason: reason || 'Disadvantage', advantage: false, disadvantage: true, isDicePool: false };
  }

  // /roll d% → d100 alias
  rest = rest.replace(/^d%/i, 'd100');

  const notationMatch = rest.match(NOTATION_RE);
  if (!notationMatch) return null;

  const notation = notationMatch[0];
  const reason   = rest.slice(notation.length).trim();
  return { type: 'roll', notation, reason, advantage: false, disadvantage: false, isDicePool: false };
}

/** Returns true if the string looks like it’s trying to be a slash command */
export function looksLikeSlash(text: string): boolean {
  return text.trimStart().startsWith('/');
}
