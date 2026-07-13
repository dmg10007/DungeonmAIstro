/**
 * rulesets/shadowrun6e.ts — Shadowrun 6th Edition ruleset module.
 */

import type { RulesetModule } from './index';
import type { Character } from '../schemas';

export const shadowrun6eModule: RulesetModule = {
  id: 'shadowrun6e',
  displayName: 'Shadowrun 6th Ed.',

  forbiddenSystems: [
    'D&D', 'D&D 5e', 'Dungeons & Dragons', 'Pathfinder', 'Call of Cthulhu',
    'GURPS', 'Savage Worlds', 'Fate',
  ],

  coreRulesBlock: `GAME SYSTEM: Shadowrun 6th Edition (SR6, Catalyst Game Labs)

You are running Shadowrun 6e. This is a cyberpunk/urban fantasy RPG set in a dystopian near-future where megacorporations rule, magic has returned, and metahumanity (elves, dwarves, orks, trolls) exists alongside cyborgs and hackers.

Core resolution mechanic: dice pools of d6s. Roll a number of d6s equal to the relevant Attribute + Skill (or other pool). Each die showing 5 or 6 counts as a Hit. Compare Hits to a threshold (usually 1–4) or oppose the target's roll.
Glitch: half or more of the dice in a pool show 1s. Net Glitch (glitch + no hits): Critical Glitch — worst possible outcome.

Edge system (SR6): Edge is a meta-currency representing narrative advantage. Characters and the GM both accumulate Edge from situational factors (higher ground, environmental advantage, clever play). Edge can be spent on powerful effects (reroll failures, add automatic hit, negate a hit, etc.).

Key systems:
- Matrix: the global AR/VR network. Hackers (Deckers) and Technomancers operate in the Matrix via cyberdeck or Living Persona. Matrix actions are interwoven with physical scene timing.
- Magic: Awakened characters (Mages, Shamans, Adepts) use magic powered by Essence. Drain damage taxes the caster after spellcasting.
- Cyberware/Bioware: implants enhance attributes but reduce Essence. Each point of Essence lost weakens magical ability and limits further augmentation.
- Contacts: the shadow economy runs on favors, information, and loyalty. Rate contacts by Connection (0–6) and Loyalty (0–6).
- Initiative: Initiative Score = Reaction + Intuition + d6 per initiative die. Characters with high scores act multiple times per round (Initiative Passes).`,

  diceBlock: `DICE SYSTEM (Shadowrun 6e):
Dice pool: Attribute + Skill (or special pool). Roll that many d6s.
Hit: any die showing 5 or 6.
Threshold: number of hits required for success (typically 1 standard, 2 moderate, 4 hard).
Opposed test: both sides roll pools; the side with more net hits wins.
Glitch: half or more dice show 1s → something goes wrong regardless of hits.
Critical Glitch: glitch AND zero hits → catastrophic failure.
Limit: caps the number of hits that count (Physical Limit, Social Limit, Mental Limit, or device Rating). Hits beyond the limit are wasted.
Edge spend during roll: declare before rolling. Effects vary by spend level (see Edge table in core rules).`,

  critRulesBlock: `CRITICAL ROLL RULES — Shadowrun 6e:
SR6 does not use a d20 crit system. Instead, use these thresholds:

EXCEPTIONAL SUCCESS: hits exceed threshold by 4 or more → outstanding result with a significant bonus effect.
STANDARD SUCCESS: hits meet or exceed threshold → the action succeeds.
FAILURE: hits below threshold → the action fails (GM narrates consequence).
GLITCH (half+ dice showing 1, but at least one hit): success comes with a complication or side effect.
CRITICAL GLITCH (half+ dice showing 1, zero hits): catastrophic failure — the worst possible narrative and mechanical outcome. Gun jams and fires into ally, hack triggers an alert AND crashes deck, spell drain knocks caster unconscious.

Edge turning the tide: if a player spends Edge after a failure, they may achieve a marginal success instead — narrate the desperate clutch moment.`,

  formatCharacter(char: Character): string {
    const sc = char.abilityScores;
    // Map D&D ability scores to closest SR6 attributes for prompt context.
    const attrLine = sc
      ? `BOD ${sc.con} | AGI ${sc.dex} | REA ${sc.dex} | STR ${sc.str} | WIL ${sc.wis} | LOG ${sc.int} | INT ${sc.wis} | CHA ${sc.cha}`
      : '(attributes unavailable — use traits block)';

    return (
      `- ${char.characterName} (${char.race} ${char.class})` +
      `\n  Physical Condition Monitor: ${char.currentHitPoints}/${char.hitPointMaximum} | Stun CM: see traits | Essence: see traits` +
      `\n  Initiative: ${char.initiative ?? '?'} | Armor: ${char.armorClass}` +
      `\n  Attributes (mapped): ${attrLine}` +
      (char.background ? `\n  Background: ${char.background}` : '') +
      (char.traits ? `\n  Skills, Gear & Edge: ${char.traits.slice(0, 400)}` : '') +
      (char.equipment ? `\n  Cyberware/Equipment: ${char.equipment.slice(0, 300)}` : '')
    );
  },
};
