/**
 * rulesets/custom.ts — Custom / homebrew ruleset module.
 *
 * The coreRulesBlock is overridden at runtime by getRulesetModule()
 * with the user-supplied customRulesetDescription.
 */

import type { RulesetModule } from './index';
import type { Character } from '../schemas';
import { abilityModifier, formatModifier } from '../dice';

export const customModule: RulesetModule = {
  id: 'custom',
  displayName: 'Custom Ruleset',

  forbiddenSystems: [],

  // Overridden by getRulesetModule() — this is just a safe fallback.
  coreRulesBlock: 'GAME SYSTEM: Custom / Homebrew\n\nNo ruleset description was provided. Use good judgment, invent fair rulings, and explain your reasoning to the player.',

  diceBlock: `DICE SYSTEM (Custom):
Use whatever dice the ruleset description specifies. If no dice system is described, default to d20 + modifier vs. DC for checks and d6 pools for contested actions. Always tell the player exactly which dice to roll and why before waiting for their result.`,

  critRulesBlock: `CRITICAL ROLL RULES (Custom):
If the ruleset description defines critical success/failure rules, apply them exactly.
Otherwise, treat a natural maximum die result as an exceptional success with a memorable positive narrative outcome, and a natural minimum (1 on a d20, all 1s in a pool) as a memorable complication or failure. Never automatically harm the character's stats from a roll result.`,

  formatCharacter(char: Character): string {
    const sc = char.abilityScores;
    const abilityLine = sc
      ? [
          `STR ${sc.str} (${formatModifier(abilityModifier(sc.str))})`,
          `DEX ${sc.dex} (${formatModifier(abilityModifier(sc.dex))})`,
          `CON ${sc.con} (${formatModifier(abilityModifier(sc.con))})`,
          `INT ${sc.int} (${formatModifier(abilityModifier(sc.int))})`,
          `WIS ${sc.wis} (${formatModifier(abilityModifier(sc.wis))})`,
          `CHA ${sc.cha} (${formatModifier(abilityModifier(sc.cha))})`,
        ].join(' | ')
      : '(ability scores unavailable)';

    return (
      `- ${char.characterName} (${char.race} ${char.class} Level ${char.level})` +
      `\n  HP: ${char.currentHitPoints}/${char.hitPointMaximum} | Defense: ${char.armorClass} | Speed: ${char.speed}` +
      `\n  Stats: ${abilityLine}` +
      (char.background ? `\n  Background: ${char.background}` : '') +
      (char.traits ? `\n  Traits: ${char.traits.slice(0, 400)}` : '') +
      (char.equipment ? `\n  Equipment: ${char.equipment.slice(0, 300)}` : '')
    );
  },
};
