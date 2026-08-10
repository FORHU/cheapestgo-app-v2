'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Wishlist for landing cards.
 *
 * Keys are namespaced by row (`flight:MNL-NRT`, `stay:<id>`, `bundle:DPS`) so
 * the same destination can be saved independently as a flight, a stay and a
 * bundle. Persisted to localStorage — hearts survive a reload without
 * requiring an account.
 */
interface SavedState {
    saved: string[];
    toggle: (key: string) => void;
    clear: () => void;
}

export const useSavedStore = create<SavedState>()(
    persist(
        (set) => ({
            saved: [],
            toggle: (key) =>
                set((s) => ({
                    saved: s.saved.includes(key)
                        ? s.saved.filter((k) => k !== key)
                        : [...s.saved, key],
                })),
            clear: () => set({ saved: [] }),
        }),
        {
            name: 'cheapestgo-saved-v2',
            storage: createJSONStorage(() => localStorage),
        }
    )
);

export const useIsSaved = (key: string) => useSavedStore((s) => s.saved.includes(key));
export const useSavedCount = () => useSavedStore((s) => s.saved.length);
