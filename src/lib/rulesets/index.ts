/**
 * rulesets/index.ts — Registry and selector for all supported TTRPG rulesets.
 *
 * Each ruleset module is isolated: it owns its own rules text, dice instructions,
 * character stat formatting, and the list of OTHER systems it must never reference.
 * This is the cross-contamination firewall.
 */

import type { Character, AdventureOptions } from '../schemas';
import { dnd5eModule } from './dnd5e';
import { pathfinder2eModule } from './pathfinder2e';
import { callofcthulhu7eModule } from './callofcthulhu7e';
import { shadowrun6eModule } from './shadowrun6e';
import { customModule } from './custom';

// ----------------------------------------------------------------
// RulesetModule interface — every ruleset must implement this
// ----------------------------------------------------------------
export interface RulesetModule {
  /** Matches the Ruleset enum value in schemas.ts */
  id: string;
  /** Human-readable name shown in the UI */
  displayName: string;
  /**
   * Core rules block injected verbatim into the system prompt.
   * Should describe the game system, core resolution mechanic, and
   * any DM-facing procedures unique to this system.
   */
  coreRulesBlock: string;
  /**
   * Dice mechanic description for this system.
   * Replaces the generic dice section in the system prompt.
   */
  diceBlock: string;
  /**
   * Critical success / failure rules for this system.
   * Replaces the shared CRITICAL_ROLL_RULES block for D&D-only crits.
   */
  critRulesBlock: string;
  /**
   * Formats a character's stats into a prompt-ready string.
   * Receives the full Character object (which has flexible fields).
   */
  formatCharacter: (char: Character) => string;
  /**
   * Names of OTHER game systems this ruleset must never reference or blend.
   * Injected as a hard prohibition in the system prompt.
   */
  forbiddenSystems: string[];
}

const REGISTRY: Record<string, RulesetModule> = {
  dnd5e: dnd5eModule,
  pathfinder2e: pathfinder2eModule,
  callofcthulhu7e: callofcthulhu7eModule,
  shadowrun6e: shadowrun6eModule,
  custom: customModule,
};

/**
 * Returns the RulesetModule for the given ruleset id.
 * Falls back to dnd5e for any unknown value (e.g. legacy campaigns).
 */
export function getRulesetModule(
  ruleset: string,
  options?: AdventureOptions,
): RulesetModule {
  const mod = REGISTRY[ruleset] ?? REGISTRY['dnd5e'];
  // For custom rulesets, splice in the user-supplied name/description
  if (ruleset === 'custom' && options) {
    return {
      ...mod,
      displayName: options.customRulesetName ?? 'Custom Ruleset',
      coreRulesBlock: buildCustomCoreBlock(options),
    };
  }
  return mod;
}

function buildCustomCoreBlock(options: AdventureOptions): string {
  const name = options.customRulesetName ?? 'Custom Homebrew';
  const desc = options.customRulesetDescription ?? 'No ruleset description provided. Use good judgment and invent fair rulings that serve the story.';
  return `GAME SYSTEM: ${name} (Custom / Homebrew)\n\n${desc}\n\nSince no standard rulebook applies, invent rulings that are internally consistent, fair, and dramatically satisfying. Always explain your reasoning to the player so they understand how the world works.`;
}
