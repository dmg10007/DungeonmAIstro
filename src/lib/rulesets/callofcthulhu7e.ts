/**
 * rulesets/callofcthulhu7e.ts — Call of Cthulhu 7th Edition ruleset module.
 */

import type { RulesetModule } from './index';
import type { Character } from '../schemas';

export const callofcthulhu7eModule: RulesetModule = {
  id: 'callofcthulhu7e',
  displayName: 'Call of Cthulhu 7th Ed.',

  forbiddenSystems: [
    'D&D', 'D&D 5e', 'Dungeons & Dragons', 'Pathfinder', 'Pathfinder 2e',
    'Shadowrun', 'GURPS', 'Savage Worlds', 'Fate',
  ],

  coreRulesBlock: `GAME SYSTEM: Call of Cthulhu 7th Edition (CoC 7e, Chaosium)

You are running Call of Cthulhu 7e. This is a horror investigation RPG, not a heroic fantasy game. Characters are vulnerable humans, not heroes. Survival and sanity preservation matter far more than combat prowess.

Core resolution mechanic: Roll d100 (percentile) equal to or under a skill value to succeed.
Hard success: roll equal to or under half the skill value (round down).
Extreme success: roll equal to or under one-fifth the skill value (round down).
Fumble: 96–100 on most checks (or 100 on skills above 50).

Key systems:
- Sanity (SAN): starts at POW × 5. Encountering the mythos, violence, or horrors causes SAN loss (roll SAN check; succeed = lower loss, fail = higher loss). Temporary Insanity triggers at 5+ SAN lost in a single scene. Indefinite Insanity triggers at losing 20% of current SAN in one session.
- Luck: a stat that can be spent to improve rolls or soaked against damage. Refreshes only when the Keeper deems it narratively appropriate.
- Push a roll: investigators may push a failed roll ONCE by re-rolling, but failure on the pushed roll has worse consequences.
- Combat: use Fighting (Brawl), Firearms, or Dodge. Damage is brutal and investigators die easily. Fleeing is often the correct choice.
- Mythos knowledge: each piece of eldritch lore increases the Cthulhu Mythos skill but permanently lowers SAN maximum.`,

  diceBlock: `DICE SYSTEM (Call of Cthulhu 7e):
Primary die: d100 (percentile — roll tens die and units die, or d100). Roll UNDER or equal to skill value to succeed.
Regular success: roll ≤ skill value.
Hard success: roll ≤ skill / 2.
Extreme success: roll ≤ skill / 5.
Fumble: 96–100 (skills 1–50) or 100 (skills 51–99).
Bonus/Penalty dice: roll an extra tens die and take the better (bonus) or worse (penalty) tens result.
Damage: uses d3, d4, d6, d8, d10 depending on weapon. Impale (extreme success on attack) deals max weapon damage + rolled damage.`,

  critRulesBlock: `CRITICAL ROLL RULES — Call of Cthulhu 7e:
CoC does not use a binary crit/miss system. Instead apply the four success tiers:

EXTREME SUCCESS (roll ≤ skill / 5): Maximum possible positive outcome — often includes a bonus, extra information, or decisive mechanical advantage.
HARD SUCCESS (roll ≤ skill / 2): A clean, unambiguous success with no complications.
REGULAR SUCCESS (roll ≤ skill): Success, possibly with a minor complication or effort.
FAILURE (roll > skill): The action fails. The player may Push the roll (re-roll) once if narratively plausible, but a pushed failure has severe consequences set in advance by the Keeper.
FUMBLE (96–100 or 100): Catastrophic failure — the worst possible outcome. Weapon jams, evidence destroyed, sanity-threatening mishap.

Always describe the degree of success or failure with appropriate horror-tinged narration. In CoC, even successes can be unsettling.`,

  formatCharacter(char: Character): string {
    // CoC uses STR/CON/SIZ/DEX/APP/INT/POW/EDU but we map from the standard 6.
    // Treat the character's free-text fields as the primary source of CoC-specific stats.
    const sc = char.abilityScores;

    const statLine = sc
      ? `STR ${sc.str} | DEX ${sc.dex} | CON ${sc.con} | INT ${sc.int} | POW ${sc.wis} | APP ${sc.cha}`
      : '(stats unavailable — use traits block)';

    return (
      `- ${char.characterName} (${char.race ?? 'Human'} Investigator, Occupation: ${char.class})` +
      `\n  HP: ${char.currentHitPoints}/${char.hitPointMaximum} | Sanity: see traits | Luck: see traits | Movement: ${char.speed ?? 8}` +
      `\n  Core Stats: ${statLine}` +
      (char.background ? `\n  Background: ${char.background}` : '') +
      (char.traits ? `\n  Skills & SAN: ${char.traits.slice(0, 400)}` : '') +
      (char.equipment ? `\n  Equipment: ${char.equipment.slice(0, 300)}` : '')
    );
  },
};
