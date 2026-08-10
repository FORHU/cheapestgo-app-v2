'use client';

import React, { useMemo } from 'react';
import { ScrollRow } from './scroll-row';
import { BundleCard, FlightDealCard, StayCard } from './cards';
import { BUNDLES_ANCHOR } from './hero';
import { useMoney } from '@/features/landing/lib/money';
import { useBudgetStore, matchesChips } from '@/features/landing/stores/budget.store';
import { HOME_AIRPORT, NIGHTS } from '@/features/landing/data/catalog';
import type { TripDates } from '@/features/landing/lib/links';
import type { BundleItem, FlightDealItem, StayItem } from '@/features/landing/lib/landing-data';

export function FlightDealsRow({ deals, dates }: { deals: FlightDealItem[]; dates: TripDates }) {
    if (deals.length === 0) return null;

    const origins = Array.from(new Set(deals.map((d) => d.origin)));
    const from = origins.length === 1 ? ` from ${origins[0]}` : '';

    return (
        <ScrollRow title={`Flight deals${from}`} subtitle="Round trip, all-in, next 60 days">
            {deals.map((deal, i) => (
                <FlightDealCard key={deal.id} deal={deal} dates={dates} priority={i < 3} />
            ))}
        </ScrollRow>
    );
}

export function StaysRow({ stays, dates }: { stays: StayItem[]; dates: TripDates }) {
    if (stays.length === 0) return null;

    return (
        <ScrollRow
            title="Stays travelers are booking"
            subtitle="Total price per night, taxes and resort fees included"
        >
            {stays.map((stay) => (
                <StayCard key={stay.id} stay={stay} dates={dates} />
            ))}
        </ScrollRow>
    );
}

/**
 * Bundles react to the "Where can I go?" panel: the budget slider retitles this
 * section and the chips filter its cards, which is where the hero's
 * "Show N destinations" button scrolls to.
 */
export function BundlesRow({ bundles, dates }: { bundles: BundleItem[]; dates: TripDates }) {
    const money = useMoney();
    const budget = useBudgetStore((s) => s.budget);
    const chips = useBudgetStore((s) => s.chips);

    const visible = useMemo(
        () => bundles.filter((b) => b.total <= budget && matchesChips(b.tags, chips)),
        [bundles, budget, chips]
    );

    return (
        <ScrollRow
            id={BUNDLES_ANCHOR}
            title={`Flight + hotel under ${money(budget)}`}
            subtitle={`One price for the whole trip, ${NIGHTS} nights, per person, from ${HOME_AIRPORT}`}
        >
            {visible.length > 0 ? (
                visible.map((bundle) => <BundleCard key={bundle.id} bundle={bundle} dates={dates} />)
            ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-10">
                    Nothing fits {money(budget)} with those filters — raise the budget or drop a filter above.
                </p>
            )}
        </ScrollRow>
    );
}
