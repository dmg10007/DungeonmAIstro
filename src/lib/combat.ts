import { z } from 'zod';
import type { CampaignState, DiceRollResult } from './schemas';
import { roll } from './dice';

// ----------------------------------------------------------------
// Condition list (5e SRD)
// ----------------------------------------------------------------
export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
] as const;
export type Condition = typeof CONDITIONS[number];

// ----------------------------------------------------------------
// Combatant schema
// ----------------------------------------------------------------
export const combatantSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  type: z.enum(['player', 'npc']),
  initiative: z.number().int().min(-5).max(50),
  initiativeRoll: z.number().int().min(1).max(20).optional(), // raw d20 result
  hpMax: z.number().int().min(1).max(999),
  hpCurrent: z.number().int().min(0).max(999),
  hpTemp: z.number().int().min(0).max(999),
  ac: z.number().int().min(0).max(30),
  conditions: z.array(z.string()),
  concentration: z.boolean(),
  deathSaves: z.object({
    successes: z.number().int().min(0).max(3),
    failures: z.number().int().min(0).max(3),
  }),
  notes: z.string().max(300),
  dexMod: z.number().int().min(-5).max(10), // for tiebreaking
});
export type Combatant = z.infer<typeof combatantSchema>;

// ----------------------------------------------------------------
// Combat state
// ----------------------------------------------------------------
export interface CombatState {
  active: boolean;
  round: number;
  turn: number; // index into sorted combatants
  combatants: Combatant[];
}

export function emptyCombatState(): CombatState {
  return { active: false, round: 1, turn: 0, combatants: [] };
}

// ----------------------------------------------------------------
// Initiative helpers
// ----------------------------------------------------------------
export function sortByInitiative(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    return b.dexMod - a.dexMod; // tiebreak by DEX modifier
  });
}

export function rollInitiative(dexMod: number): { roll: number; total: number } {
  const result = roll('d20', 'player', undefined, 'Initiative');
  const raw = result.rolls[0];
  return { roll: raw, total: raw + dexMod };
}

// ----------------------------------------------------------------
// HP helpers
// ----------------------------------------------------------------
export function applyDamage(c: Combatant, amount: number): Combatant {
  const amt = Math.max(0, amount);
  let temp = c.hpTemp;
  let curr = c.hpCurrent;

  // Absorb into temp HP first
  if (temp > 0) {
    const absorbed = Math.min(temp, amt);
    temp -= absorbed;
    const remaining = amt - absorbed;
    curr = Math.max(0, curr - remaining);
  } else {
    curr = Math.max(0, curr - amt);
  }

  // Auto-unconcious at 0 HP
  const conditions = curr === 0 && !c.conditions.includes('Unconscious')
    ? [...c.conditions, 'Unconscious']
    : c.conditions;

  return { ...c, hpCurrent: curr, hpTemp: temp, conditions };
}

export function applyHealing(c: Combatant, amount: number): Combatant {
  const curr = Math.min(c.hpMax, c.hpCurrent + Math.max(0, amount));
  // Remove unconscious if healed above 0
  const conditions = curr > 0
    ? c.conditions.filter(cd => cd !== 'Unconscious')
    : c.conditions;
  return { ...c, hpCurrent: curr, conditions };
}

export function setTempHP(c: Combatant, amount: number): Combatant {
  // Temp HP doesn't stack — take the higher value
  return { ...c, hpTemp: Math.max(c.hpTemp, Math.max(0, amount)) };
}

// ----------------------------------------------------------------
// Condition helpers
// ----------------------------------------------------------------
export function toggleCondition(c: Combatant, condition: string): Combatant {
  const has = c.conditions.includes(condition);
  return {
    ...c,
    conditions: has
      ? c.conditions.filter(cd => cd !== condition)
      : [...c.conditions, condition],
  };
}

// ----------------------------------------------------------------
// Campaign event helpers
// ----------------------------------------------------------------
export function logCombatStart(
  campaign: CampaignState,
  participants: string[]
): CampaignState {
  return {
    ...campaign,
    events: [
      ...campaign.events,
      { type: 'combat_started', timestamp: new Date().toISOString(), participants },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function logRoundAdvanced(
  campaign: CampaignState,
  round: number
): CampaignState {
  return {
    ...campaign,
    events: [
      ...campaign.events,
      { type: 'combat_round_advanced', timestamp: new Date().toISOString(), round },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function logCombatEnd(campaign: CampaignState): CampaignState {
  return {
    ...campaign,
    events: [
      ...campaign.events,
      { type: 'combat_ended', timestamp: new Date().toISOString() },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function logDiceRoll(
  campaign: CampaignState,
  result: DiceRollResult
): CampaignState {
  return {
    ...campaign,
    events: [
      ...campaign.events,
      { type: 'dice_rolled', timestamp: new Date().toISOString(), result },
    ],
    updatedAt: new Date().toISOString(),
  };
}
