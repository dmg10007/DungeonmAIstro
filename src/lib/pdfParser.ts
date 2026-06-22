/**
 * pdfParser.ts — Extract character data from a filled D&D 5e character sheet PDF.
 * Uses pdf.js (pdfjs-dist) loaded from the npm package.
 * Worker is pointed at the CDN to avoid bundling the large worker binary.
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { Character } from '../types';
import { generateId } from './storage';

// Point worker at CDN to avoid bundling the 1 MB worker file
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/** Extract all AcroForm field values from a PDF file */
async function extractPdfFields(file: File): Promise<Record<string, string>> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const fields: Record<string, string> = {};

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const annotations = await page.getAnnotations();
    for (const ann of annotations) {
      if (ann.fieldName && ann.fieldValue !== undefined) {
        fields[ann.fieldName] = String(ann.fieldValue);
      }
    }
  }
  return fields;
}

function num(fields: Record<string, string>, ...keys: string[]): number {
  for (const k of keys) {
    const v = parseInt(fields[k] ?? '', 10);
    if (!isNaN(v)) return v;
  }
  return 0;
}

function str(fields: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) { if (fields[k]) return fields[k].trim(); }
  return '';
}

/** Parse a standard D&D 5e fillable PDF into a Character object */
export async function parseCharacterSheet(file: File): Promise<Partial<Character>> {
  const f = await extractPdfFields(file);

  const now = Date.now();
  return {
    id: generateId(),
    name:       str(f, 'CharacterName', 'CharacterName 2'),
    race:       str(f, 'Race ', 'Race'),
    class:      str(f, 'ClassLevel').replace(/\d+/g, '').trim(),
    level:      num(f, 'ClassLevel') || parseInt(str(f, 'ClassLevel').replace(/\D/g, ''), 10) || 1,
    background: str(f, 'Background'),
    alignment:  str(f, 'Alignment'),
    experiencePoints: num(f, 'XP', 'XP_'),
    abilityScores: {
      strength:     num(f, 'STR', 'Strength'),
      dexterity:    num(f, 'DEX', 'Dexterity'),
      constitution: num(f, 'CON', 'Constitution'),
      intelligence: num(f, 'INT', 'Intelligence'),
      wisdom:       num(f, 'WIS', 'Wisdom'),
      charisma:     num(f, 'CHA', 'Charisma'),
    },
    hitPoints: {
      current:   num(f, 'HPCurrent', 'HP Current'),
      maximum:   num(f, 'HPMax', 'HPMax'),
      temporary: num(f, 'HPTemp', 'HPTemp'),
    },
    armorClass:      num(f, 'AC', 'ArmorClass'),
    initiative:      num(f, 'Initiative'),
    speed:           num(f, 'Speed'),
    proficiencyBonus: num(f, 'ProfBonus', 'Proficiency Bonus'),
    savingThrows: {},
    skills: {},
    features: [],
    equipment: str(f, 'Equipment').split('\n').filter(Boolean),
    notes: str(f, 'Features and Traits', 'Backstory', 'Allies', 'Treasure'),
    createdAt: now,
    updatedAt: now,
  };
}
