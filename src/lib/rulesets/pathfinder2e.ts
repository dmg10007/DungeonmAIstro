/**
 * rulesets/pathfinder2e.ts — Pathfinder 2nd Edition ruleset module.
 */

import type { RulesetModule } from './index';
import type { Character } from '../schemas';
import { abilityModifier, formatModifier } from '../dice';

export const pathfinder2eModule: RulesetModule = {
  id: 'pathfinder2e',
  displayName: 'Pathfinder 2nd Edition',

  forbiddenSystems: [
    'D&D', 'D&D 5e', 'Dungeons & Dragons', 'Call of Cthulhu', 'CoC',
    'Shadowrun', 'GURPS', 'Savage Worlds', 'Fate',
  ],

  coreRulesBlock: `GAME SYSTEM: Pathfinder 2nd Edition (PF2e)

You are running Pathfinder 2e. Apply rules as written in the Pathfinder Core Rulebook (2nd Edition, Paizo).

Core resolution mechanic: d20 + modifier vs. Difficulty Class (DC).
Four degrees of success: Critical Success (beat DC by 10+), Success, Failure, Critical Failure (miss DC by 10+).
The degree shifts up or down by one tier on a natural 20 or natural 1.

Three-action economy: each turn a character has 3 actions and 1 reaction.
Common actions: Strike (1), Move (1), Cast a Spell (1–3), Raise a Shield (1), Demoralize (1).
Activity traits: some actions have the Attack trait and incur the Multiple Attack Penalty (MAP): 0 / –5 / –10 (or –4/–8 with agile weapons).

Key systems:
- Proficiency ranks: Untrained (–2 or +0), Trained (+2), Expert (+4), Master (+6), Legendary (+8) added to d20 + ability modifier + level.
- Ancestry, Heritage, Background, and Class together define a character's identity and abilities.
- Conditions track status effects (frightened, grabbed, flat-footed, etc.) with numerical values that tick down.
- Hero Points: players start each session with 1. Spending one rerolls a check; spending all 3 prevents dying.
- Resonance and Bulk track item capacity.`,

  diceBlock: `DICE SYSTEM (Pathfinder 2e):
Primary die: d20 for all checks (attack, skill, save, perception).
Damage dice: d4, d6, d8, d10, d12 depending on weapon/spell. Critical hits deal double damage (roll all dice twice, double all bonuses).
All rolls: d20 + proficiency rank bonus + ability modifier + item bonus + circumstance bonus + status bonus vs. DC.
Degrees of success matter: always determine which tier applies (Critical Success / Success / Failure / Critical Failure) and apply the correct outcome for each, as they are explicitly listed in the rules for every action and spell.`,

  critRulesBlock: `CRITICAL ROLL RULES — Pathfinder 2e:
PF2e uses four degrees of success, not a simple crit/miss binary.

DEGREE DETERMINATION:
1. Compare total roll to DC.
2. Beat DC by 10 or more → Critical Success.
3. Meet or beat DC → Success.
4. Miss DC by 1–9 → Failure.
5. Miss DC by 10 or more → Critical Failure.
6. Natural 20 on die face → shift result one degree UP (Failure → Success, Success → Critical Success).
7. Natural 1 on die face → shift result one degree DOWN (Success → Failure, Critical Success → Success).

Always apply the specific outcome listed for that degree in the relevant rule (spell, action, or skill). Do not invent generic outcomes — consult the stated degree consequences.

IMPORTANT: A natural 20 does NOT automatically equal a Critical Success unless the shift brings it there. A natural 1 does NOT automatically equal a Critical Failure unless the shift brings it there.`,

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
      `\n  AC: ${char.armorClass} | HP: ${char.currentHitPoints}/${char.hitPointMaximum} | Speed: ${char.speed}ft` +
      `\n  Perception: ${formatModifier((sc ? abilityModifier(sc.wis) : 0) + char.proficiencyBonus)} | Class DC: ${10 + char.proficiencyBonus + (sc ? abilityModifier(sc.str) : 0)}` +
      `\n  Ability Modifiers: ${abilityLine}` +
      (char.background ? `\n  Background: ${char.background}` : '') +
      (char.equipment ? `\n  Equipment: ${char.equipment.slice(0, 300)}` : '') +
      (char.traits ? `\n  Traits/Feats: ${char.traits.slice(0, 200)}` : '')
    );
  },
};
