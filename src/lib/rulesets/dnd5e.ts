/**
 * rulesets/dnd5e.ts — Dungeons & Dragons 5th Edition ruleset module.
 *
 * All D&D-specific prompt text lives here and ONLY here.
 * It must never be injected when a different ruleset is active.
 */

import type { RulesetModule } from './index';
import type { Character } from '../schemas';
import { abilityModifier, formatModifier } from '../dice';

export const dnd5eModule: RulesetModule = {
  id: 'dnd5e',
  displayName: 'D&D 5th Edition',

  forbiddenSystems: [
    'Pathfinder', 'Pathfinder 2e', 'Call of Cthulhu', 'CoC',
    'Shadowrun', 'GURPS', 'Savage Worlds', 'Fate', 'World of Darkness',
    'Vampire: The Masquerade', 'Blades in the Dark',
  ],

  coreRulesBlock: `GAME SYSTEM: Dungeons & Dragons 5th Edition (D&D 5e)

You are running D&D 5e. Apply the rules as written in the Player's Handbook, Dungeon Master's Guide, and Monster Manual (2014 core set) unless the rules strictness setting overrides this.

Core resolution mechanic: d20 + modifier vs. Difficulty Class (DC).
The six ability scores (STR, DEX, CON, INT, WIS, CHA) drive all checks.
Proficiency bonus applies when a character is proficient in a skill, tool, or saving throw.
Advantage: roll two d20s, take the higher. Disadvantage: roll two d20s, take the lower.
Passive scores: 10 + relevant modifier (+ 5 if proficient) — use these for background perception without calling for a roll.

Combat: initiative order, action/bonus action/reaction economy, movement, concentration spells, death saving throws.
Spellcasting: spell slots, components, concentration, ritual casting.
Rests: short rest (1 hour, spend Hit Dice), long rest (8 hours, full HP and spell slot recovery).`,

  diceBlock: `DICE SYSTEM (D&D 5e):
Primary die: d20 for all ability checks, attack rolls, and saving throws.
Damage dice: d4, d6, d8, d10, d12 depending on weapon or spell.
Percentile: d100 (d10 tens + d10 units) for wild magic surges and random tables.
All rolls: d20 face value + applicable modifier = total. Compare total to DC or target AC.
Double-modifier rule: NEVER add modifiers twice. If the player reports a total that already includes their modifier, accept it as-is.`,

  critRulesBlock: `CRITICAL ROLL RULES — D&D 5e:
CRITICAL SUCCESS (Natural 20 on the d20 face — before modifiers):
- Spectacular, extraordinary success beyond a normal success.
- Attack rolls: roll all damage dice twice, then add modifier once.
- Ability checks / skill checks: invent a uniquely memorable positive outcome.
- The character's stats and HP are NOT modified. Effect is narrative and situational.
- Mark the moment with dramatic language.

CRITICAL FAILURE (Natural 1 on the d20 face — before modifiers):
- Catastrophic or darkly comedic failure beyond a normal failure.
- Attack rolls: the attack misses spectacularly (no automatic damage to self).
- Ability checks: invent a memorable complication or embarrassment.
- The character's stats and HP are NOT modified. Effect is narrative and situational.
- Play it with dark humour or dramatic irony.

IMPORTANT: Only treat a roll as a critical when the raw face value is explicitly 1 or 20.
A total of 20 from 17+3 is NOT a critical.`,

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

    const spellLine = char.spellcastingClass
      ? `\n  Spellcasting: ${char.spellcastingClass} | Ability: ${char.spellcastingAbility ?? '?'} | Save DC: ${char.spellSaveDC ?? '?'} | Atk bonus: ${char.spellAttackBonus != null ? formatModifier(char.spellAttackBonus) : '?'}`
      : '';

    return (
      `- ${char.characterName} (${char.race} ${char.class} Level ${char.level})` +
      `\n  AC: ${char.armorClass} | HP: ${char.currentHitPoints}/${char.hitPointMaximum}${char.temporaryHitPoints ? ` (${char.temporaryHitPoints} temp)` : ''} | Speed: ${char.speed}ft` +
      `\n  Initiative: ${formatModifier(char.initiative ?? (sc ? abilityModifier(sc.dex) : 0))} | Proficiency Bonus: +${char.proficiencyBonus}` +
      `\n  Ability Scores: ${abilityLine}` +
      (char.background ? `\n  Background: ${char.background}` : '') +
      (char.alignment ? ` | Alignment: ${char.alignment}` : '') +
      spellLine +
      (char.equipment ? `\n  Equipment: ${char.equipment.slice(0, 300)}` : '') +
      (char.traits ? `\n  Traits: ${char.traits.slice(0, 200)}` : '')
    );
  },
};
