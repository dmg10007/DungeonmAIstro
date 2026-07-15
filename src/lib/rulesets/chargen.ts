/**
 * chargen.ts — Per-ruleset character-creation field configurations.
 *
 * Each RulesetChargenConfig is a pure data object consumed by CharacterLab.
 * No React, no side-effects — safe to unit-test in isolation.
 */

import type { Ruleset } from '../schemas';

// ─── Extra field descriptors ────────────────────────────────────────────────
export interface ExtraField {
  /** Unique key stored on the form state */
  key: string;
  /** Display label */
  label: string;
  /** Short tooltip / helper text */
  hint: string;
  type: 'number' | 'text';
  min?: number;
  max?: number;
  defaultValue: number | string;
}

// ─── Stat block descriptor ───────────────────────────────────────────────────
export interface StatDescriptor {
  /** Short key matching Character.abilityScores key — or a virtual key for non-D&D systems */
  key: string;
  /** e.g. "Strength", "Body", "STR" */
  label: string;
  /** Long tooltip text */
  hint: string;
}

// ─── Per-ruleset config ──────────────────────────────────────────────────────
export interface RulesetChargenConfig {
  /** Human-readable system name shown in the lab header */
  systemName: string;
  /** Label for the "race" concept (Race / Ancestry / Metatype / Species) */
  speciesLabel: string;
  species: string[];
  /** Label for the "class" concept (Class / Archetype / Occupation) */
  classLabel: string;
  classes: string[];
  /** Label for the "background" concept. Empty array = field hidden */
  backgroundLabel: string;
  backgrounds: string[];
  /** Alignment options. Empty array = field hidden */
  alignments: string[];
  /** Ordered stat block */
  stats: StatDescriptor[];
  /**
   * Extra fields unique to this system rendered below the stat block.
   * e.g. Sanity for CoC, Essence / Edge for Shadowrun.
   */
  extraFields: ExtraField[];
  /** Whether the standard D&D ability-score chargen helpers apply */
  useDndStatMethods: boolean;
  /** Whether the "Level" field should be shown (hidden for CoC, SR which use different advancement) */
  showLevel: boolean;
  /** Label override for "Level" (e.g. "Rank" for some games) */
  levelLabel: string;
}

// ─── D&D 5e ──────────────────────────────────────────────────────────────────
const DND5E: RulesetChargenConfig = {
  systemName: 'D&D 5e',
  speciesLabel: 'Race',
  species: ['Human','Elf','Dwarf','Halfling','Dragonborn','Gnome','Half-Elf','Half-Orc','Tiefling'],
  classLabel: 'Class',
  classes: ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'],
  backgroundLabel: 'Background',
  backgrounds: ['Acolyte','Charlatan','Criminal','Entertainer','Folk Hero','Guild Artisan','Hermit','Noble','Outlander','Sage','Sailor','Soldier','Urchin'],
  alignments: ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'],
  stats: [
    { key: 'str', label: 'STR', hint: 'Strength covers physical power, lifting, climbing, jumping, melee force, and Athletics checks.' },
    { key: 'dex', label: 'DEX', hint: 'Dexterity affects initiative, stealth, reflexes, ranged attacks, finesse weapons, and many Armor Class calculations.' },
    { key: 'con', label: 'CON', hint: 'Constitution affects hit points, endurance, toughness, and concentration-related checks.' },
    { key: 'int', label: 'INT', hint: 'Intelligence supports memory, reasoning, investigation, arcane knowledge, and Wizard spellcasting.' },
    { key: 'wis', label: 'WIS', hint: 'Wisdom covers perception, insight, instincts, survival, and Cleric or Druid spellcasting.' },
    { key: 'cha', label: 'CHA', hint: 'Charisma drives persuasion, deception, presence, performance, leadership, and several spellcasting classes.' },
  ],
  extraFields: [],
  useDndStatMethods: true,
  showLevel: true,
  levelLabel: 'Level',
};

// ─── Pathfinder 2e ───────────────────────────────────────────────────────────
const PF2E: RulesetChargenConfig = {
  systemName: 'Pathfinder 2e',
  speciesLabel: 'Ancestry',
  species: ['Human','Elf','Dwarf','Gnome','Goblin','Halfling','Leshy','Orc','Catfolk','Fetchling','Fleshwarp','Kitsune','Ratfolk','Tengu'],
  classLabel: 'Class',
  classes: ['Alchemist','Barbarian','Bard','Champion','Cleric','Druid','Fighter','Gunslinger','Inventor','Investigator','Magus','Monk','Oracle','Psychic','Ranger','Rogue','Sorcerer','Summoner','Swashbuckler','Thaumaturge','Witch','Wizard'],
  backgroundLabel: 'Background',
  backgrounds: ['Acolyte','Acrobat','Animal Whisperer','Artisan','Artist','Barkeep','Barrister','Bounty Hunter','Charlatan','Criminal','Detective','Emissary','Entertainer','Farmhand','Field Medic','Fortune Teller','Gladiator','Guard','Herbalist','Hermit','Hunter','Laborer','Martial Disciple','Merchant','Nomad','Noble','Pilgrim','Sailor','Scholar','Scout','Street Urchin','Tinker','Warrior'],
  alignments: ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'],
  stats: [
    { key: 'str', label: 'STR', hint: 'Strength governs Athletics, melee attack rolls, and carry capacity.' },
    { key: 'dex', label: 'DEX', hint: 'Dexterity governs AC, Reflex saves, Acrobatics, Stealth, and ranged attacks.' },
    { key: 'con', label: 'CON', hint: 'Constitution governs hit points and Fortitude saves.' },
    { key: 'int', label: 'INT', hint: 'Intelligence governs trained skills (number), Crafting, Lore, and Arcane.' },
    { key: 'wis', label: 'WIS', hint: 'Wisdom governs Perception, Will saves, Medicine, Nature, Religion, Survival.' },
    { key: 'cha', label: 'CHA', hint: 'Charisma governs Deception, Diplomacy, Intimidation, Performance, and Occult.' },
  ],
  extraFields: [],
  useDndStatMethods: true,
  showLevel: true,
  levelLabel: 'Level',
};

// ─── Call of Cthulhu 7e ──────────────────────────────────────────────────────
const COC7E: RulesetChargenConfig = {
  systemName: 'Call of Cthulhu 7e',
  speciesLabel: 'Archetype',
  species: ['Antiquarian','Artist','Author','Clergy','Criminal','Dilettante','Doctor of Medicine','Drifter','Engineer','Entertainer','Journalist','Lawyer','Military Officer','Missionary','Musician','Nurse','Occultist','Parapsychologist','Police Detective','Private Investigator','Professor','Scientist','Soldier','Tribe Member'],
  classLabel: 'Era',
  classes: ['1920s','Modern','Dark Ages','Gaslight','Pulp'],
  backgroundLabel: 'Personal Description',
  backgrounds: [],
  alignments: [],
  stats: [
    { key: 'str', label: 'STR', hint: 'Strength (3–18 ×5 = percentile). Used for Climb, Jump, Swim, and melee damage.' },
    { key: 'dex', label: 'DEX', hint: 'Dexterity (3–18 ×5). Used for Dodge, Handgun, Pilot, Sleight of Hand.' },
    { key: 'con', label: 'CON', hint: 'Constitution (3–18 ×5). Used for Hit Points and resistance to damage.' },
    { key: 'int', label: 'INT', hint: 'Intelligence (3–18 ×5). Used for Idea rolls, Occult, Library Use, and skill points.' },
    { key: 'wis', label: 'POW', hint: 'Power (3–18 ×5). Determines your starting Sanity and Magic Points.' },
    { key: 'cha', label: 'APP', hint: 'Appearance (3–18 ×5). Used for social interactions and first impressions.' },
  ],
  extraFields: [
    {
      key: 'sanity',
      label: 'Starting Sanity',
      hint: 'Equals POW×5 at character creation. Maximum 99 minus Cthulhu Mythos skill.',
      type: 'number',
      min: 0,
      max: 99,
      defaultValue: 50,
    },
    {
      key: 'luck',
      label: 'Luck',
      hint: 'Roll 3d6×5 at creation (15–90). Spent to avoid bad outcomes; replenishes between sessions.',
      type: 'number',
      min: 0,
      max: 99,
      defaultValue: 50,
    },
    {
      key: 'magicPoints',
      label: 'Magic Points',
      hint: 'Equals POW÷5 (round down). Used to cast spells and resist the Mythos.',
      type: 'number',
      min: 0,
      max: 30,
      defaultValue: 10,
    },
  ],
  useDndStatMethods: false,
  showLevel: false,
  levelLabel: 'Level',
};

// ─── Shadowrun 6e ────────────────────────────────────────────────────────────
const SR6E: RulesetChargenConfig = {
  systemName: 'Shadowrun 6e',
  speciesLabel: 'Metatype',
  species: ['Human','Elf','Dwarf','Ork','Troll'],
  classLabel: 'Archetype',
  classes: ['Street Samurai','Adept','Mage','Shaman','Rigger','Decker','Face','Technomancer','Smuggler','Mercenary'],
  backgroundLabel: 'Background',
  backgrounds: ['Corporate','Street','Gang','Shadow Community','Academic','Government','Criminal Underworld','Tribal','Awakened Community','Technomancer Underground'],
  alignments: [],
  stats: [
    { key: 'str', label: 'BOD', hint: 'Body — physical toughness, damage resistance, and resist physical drain.' },
    { key: 'dex', label: 'AGI', hint: 'Agility — physical coordination, most combat skills, and sneaking.' },
    { key: 'con', label: 'REA', hint: 'Reaction — reflexes, initiative dice, and dodging.' },
    { key: 'int', label: 'STR', hint: 'Strength — melee damage, lifting, and physical endurance tests.' },
    { key: 'wis', label: 'WIL', hint: 'Willpower — resist mental stress, drain from magic/tech, and composure.' },
    { key: 'cha', label: 'CHA', hint: 'Charisma — social skills, negotiation, leadership, and con.' },
  ],
  extraFields: [
    {
      key: 'essence',
      label: 'Essence',
      hint: 'Starts at 6.0. Reduced by cyberware/bioware. Reaches 0 = death. Limits Magic and Resonance.',
      type: 'number',
      min: 0,
      max: 6,
      defaultValue: 6,
    },
    {
      key: 'edge',
      label: 'Edge',
      hint: 'Personal Edge rating (1–7). Spent for narrative advantages; refreshes each scene.',
      type: 'number',
      min: 1,
      max: 7,
      defaultValue: 3,
    },
    {
      key: 'magic',
      label: 'Magic / Resonance',
      hint: 'Rating for Awakened or Technomancer characters. 0 for mundanes.',
      type: 'number',
      min: 0,
      max: 12,
      defaultValue: 0,
    },
  ],
  useDndStatMethods: false,
  showLevel: false,
  levelLabel: 'Rank',
};

// ─── Custom ───────────────────────────────────────────────────────────────────
const CUSTOM: RulesetChargenConfig = {
  systemName: 'Custom Ruleset',
  speciesLabel: 'Species / Origin',
  species: ['Human','Humanoid','Construct','Undead','Outsider','Beast','Other'],
  classLabel: 'Role / Class',
  classes: ['Warrior','Scout','Mage','Healer','Leader','Trickster','Specialist','Other'],
  backgroundLabel: 'Background',
  backgrounds: ['Soldier','Scholar','Merchant','Criminal','Noble','Wanderer','Artisan','Outcast'],
  alignments: ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'],
  stats: [
    { key: 'str', label: 'STR', hint: 'Physical power and melee capability.' },
    { key: 'dex', label: 'DEX', hint: 'Speed, agility, and finesse.' },
    { key: 'con', label: 'CON', hint: 'Endurance and toughness.' },
    { key: 'int', label: 'INT', hint: 'Reasoning and knowledge.' },
    { key: 'wis', label: 'WIS', hint: 'Intuition and willpower.' },
    { key: 'cha', label: 'CHA', hint: 'Social influence and presence.' },
  ],
  extraFields: [],
  useDndStatMethods: true,
  showLevel: true,
  levelLabel: 'Level',
};

// ─── Registry ────────────────────────────────────────────────────────────────
const CONFIGS: Record<Ruleset, RulesetChargenConfig> = {
  dnd5e:          DND5E,
  pathfinder2e:   PF2E,
  callofcthulhu7e: COC7E,
  shadowrun6e:    SR6E,
  custom:         CUSTOM,
};

export function getRulesetChargenConfig(ruleset: Ruleset): RulesetChargenConfig {
  return CONFIGS[ruleset] ?? DND5E;
}
