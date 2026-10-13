'use client';

import { create } from 'zustand';
import { BUDGET_DEFAULT, BUDGET_FILTERS, TRIPS, tripTotal, type TripSeed } from '@/features/landing/data/catalog';

/**
 * State for the "Where can I go?" explorer.
 *
 * Lives outside the hero because the bundles row downstream reads the same
 * budget and chips — moving the slider retitles that section and filters its
 * cards, so the panel's "Show N destinations" button has somewhere real to go.
 */
interface BudgetState {
    budget: number;
    chips: string[];
    setBudget: (n: number) => void;
    toggleChip: (id: string) => void;
    reset: () => void;
}

export const useBudgetStore = create<BudgetState>((set) => ({
    budget: BUDGET_DEFAULT,
    chips: [],
    setBudget: (budget) => set({ budget }),
    toggleChip: (id) =>
        set((s) => ({
            chips: s.chips.includes(id) ? s.chips.filter((c) => c !== id) : [...s.chips, id],
        })),
    reset: () => set({ budget: BUDGET_DEFAULT, chips: [] }),
}));

export const useBudget = () => useBudgetStore((s) => s.budget);
export const useBudgetChips = () => useBudgetStore((s) => s.chips);

/** Catalog trips that fit the budget and satisfy every active chip. */
export function matchTrips(budget: number, chips: string[]): TripSeed[] {
    const tests = chips
        .map((id) => BUDGET_FILTERS.find((f) => f.id === id))
        .filter((f): f is (typeof BUDGET_FILTERS)[number] => f != null);

    return TRIPS
        .filter((t) => tripTotal(t) <= budget)
        .filter((t) => tests.every((f) => f.test(t)))
        .sort((a, b) => tripTotal(a) - tripTotal(b));
}

/** True when a bundle's precomputed tags satisfy every active chip. */
export function matchesChips(tags: string[], chips: string[]): boolean {
    return chips.every((c) => tags.includes(c));
}
