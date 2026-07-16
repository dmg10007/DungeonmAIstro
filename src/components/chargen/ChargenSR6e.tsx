import { useMemo, useState } from 'react';
import { characterSchema } from '../../lib/schemas';
import { newId, saveCharacter } from '../../lib/storage';
import { addCharacterToActiveCampaign } from '../../lib/storageHelpers';
import { getRulesetChargenConfig } from '../../lib/rulesets/chargen';
import type { ChargenProps } from './types';

const cfg = getRulesetChargenConfig('shadowrun6e');

// ── Priority Table ────────────────────────────────────────────────────────────
type Priority = 'A' | 'B' | 'C' | 'D' | 'E';
type PriorityCategory = 'metatype' | 'attributes' | 'magic' | 'skills' | 'resources';

const PRIORITY_DATA: Record<Priority, {
  metatype: string;
  attributes: number;
  magic: string;
  skills: number;
  resources: string;
}> = {
  A: { metatype: 'Human (9) / Elf (8)',    attributes: 24, magic: 'Full (4) / Tech (4)', skills: 32, resources: '450,000¥' },
  B: { metatype: 'Dwarf/Ork (7)',           attributes: 20, magic: 'Full (3) / Tech (3)', skills: 24, resources: '275,000¥' },
  C: { metatype: 'Troll/Human (5)',          attributes: 16, magic: 'Full (2)',             skills: 20, resources: '140,000¥