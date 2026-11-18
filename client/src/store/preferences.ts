import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferencesState {
  /** City (or province) the visitor is browsing in; empty = all locations. */
  city: string;
  setCity: (city: string) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      city: '',
      setCity: (city) => set({ city }),
    }),
    { name: 'rentora-preferences' },
  ),
);
