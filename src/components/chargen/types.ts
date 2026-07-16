import type { Character } from '../../lib/schemas';
import type { WeightProfile } from '../../lib/chargen';

export type { WeightProfile };

export interface ChargenProps {
  onCreated: (character: Character) => void;
}
