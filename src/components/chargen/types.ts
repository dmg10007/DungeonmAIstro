import type { Character } from '../../lib/schemas';

export interface ChargenProps {
  onCreated: (character: Character) => void;
}
