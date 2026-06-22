import { create } from 'zustand';
import type { Character, Campaign, Session, DiceRoll } from '../types';

interface AppState {
  // Active entities
  character: Character | null;
  campaign: Campaign | null;
  session: Session | null;

  // Dice roll history for current session
  rollHistory: DiceRoll[];

  // UI state
  theme: 'light' | 'dark';

  // Actions
  setCharacter: (c: Character | null) => void;
  setCampaign: (c: Campaign | null) => void;
  setSession: (s: Session | null) => void;
  addRoll: (roll: DiceRoll) => void;
  clearRolls: () => void;
  setTheme: (t: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>((set) => ({
  character: null,
  campaign: null,
  session: null,
  rollHistory: [],
  theme: (localStorage.getItem('dm_theme') as 'light' | 'dark') ?? 'dark',

  setCharacter: (c) => set({ character: c }),
  setCampaign: (c) => set({ campaign: c }),
  setSession: (s) => set({ session: s }),
  addRoll: (roll) => set((state) => ({ rollHistory: [...state.rollHistory, roll] })),
  clearRolls: () => set({ rollHistory: [] }),
  setTheme: (t) => {
    localStorage.setItem('dm_theme', t);
    document.documentElement.setAttribute('data-theme', t);
    set({ theme: t });
  },
}));
