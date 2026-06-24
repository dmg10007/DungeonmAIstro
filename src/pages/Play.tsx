import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import DiceRoller from '../components/DiceRoller';
import CombatTracker from '../components/CombatTracker';
import { getActiveCampaignId, loadCampaign, appendEvent } from '../lib/storage';
import { listVaultEntries } from '../lib/vault';
import { sendToDM } from '../lib/dm';
import { roll, abilityModifier, formatModifier } from '../lib/dice';
import type { Character, DiceRollResult } from '../lib/schemas';

// 'event' is a local-only role for dice rolls and game events.
interface Message {
  role: 'user' | 'assistant' | 'event';
  content: string;
  timestamp: string;
}

const RULES_LABELS: Record<number, string> = {
  1: 'By the Book', 2: 'Mostly RAW', 3: 'Balanced', 4: 'Flexible', 5: 'Rule of Cool',
};
const NARRATIVE_LABELS: Record<number, string> = {
  1: 'Pure Narrative', 2: 'Story-first', 3: 'Balanced', 4: 'Dice-leaning', 5: 'Dice Heavy',
};
const VERBOSITY_LABELS: Record<number, string> = {
  1: 'Terse', 2: 'Concise', 3: 'Balanced', 4: 'Rich', 5: 'Verbose',
};

const ABILITY_LABELS: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

// ---------------------------------------------------------------------------
// Crit detection helpers
// ---------------------------------------------------------------------------
function detectCrit(result: DiceRollResult): 'nat20' | 'nat1' | null {
  if (!result.notation.toLowerCase().includes('d20')) return null;
  if (result.rolls.includes(20)) return 'nat20';
  if (result.rolls.includes(1)) return 'nat1';
  return null;
}

function buildCritMessage(result: DiceRollResult, critType: 'nat20' | 'nat1'): string {
  const tag = critType === 'nat20' ? '[CRIT SUCCESS — Natural 20]' : '[CRIT FAILURE — Natural 1]';
  const label = result.reason ? ` on ${result.reason}` : '';
  const rollStr = result.rolls.length > 1
    ? `rolled [${result.rolls.join(', ')}] (${critType === 'nat20' ? 'taking the highest' : 'taking the lowest'}), total ${result.total}`
    : `rolled ${result.total}`;
  return `${tag} I just ${rollStr}${label}. Please narrate a ${critType === 'nat20' ? 'spectacular critical success' : 'catastrophic critical failure'} for this action as described in your critical roll rules — unique, memorable, and without modifying any ability scores or stats.`;
}

function buildRollNotifyMessage(result: DiceRollResult): string {
  const label = result.reason ? ` for ${result.reason}` : '';
  const rollStr = result.rolls.length > 1
    ? `[${result.rolls.join(', ')}], total ${result.total}`
    : `${result.total}`;
  return `[DICE ROLL] I rolled ${result.notation}${label}: ${rollStr}. Please incorporate this result into the narrative as appropriate.`;
}

// ---------------------------------------------------------------------------
// Slash command parser
// ---------------------------------------------------------------------------
const SLASH_RE = /^\/(?:roll|r)\s+(.*)/i;
const ADV_SHORTHAND = /^\/adv(?:antage)?\s*(.*)/i;
const DIS_SHORTHAND = /^\/dis(?:advantage)?\s*(.*)/i;
const NOTATION_RE = /^(\d{1,2})?d(4|6|8|10|12|20|100)([+-]\d{1,3})?/i;

interface SlashRollParsed {
  type: 'roll';
  notation: string;
  reason: string;
  advantage: boolean;
  disadvantage: boolean;
}

function parseSlashCommand(text: string): SlashRollParsed | null {
  const trimmed = text.trim();
  const advMatch = trimmed.match(ADV_SHORTHAND);
  if (advMatch) return { type: 'roll', notation: 'd20', reason: advMatch[1].trim() || 'Advantage', advantage: true, disadvantage: false };
  const disMatch = trimmed.match(DIS_SHORTHAND);
  if (disMatch) return { type: 'roll', notation: 'd20', reason: disMatch[1].trim() || 'Disadvantage', advantage: false, disadvantage: true };
  const rollMatch = trimmed.match(SLASH_RE);
  if (!rollMatch) return null;
  const rest = rollMatch[1].trim();
  if (/^adv(?:antage)?\s*/i.test(rest)) {
    const reason = rest.replace(/^adv(?