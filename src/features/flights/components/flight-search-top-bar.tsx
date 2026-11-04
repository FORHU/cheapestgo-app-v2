'use client';

import { useTranslations } from 'next-intl';
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { ICON_BTN } from '@/features/search/components/search-chrome';
import {
    BarAccountButton, BarFiltersButton, BarThemeButton, barStyles, type SearchTopBarProps,
} from '@/features/search/components/search-top-bar';
import { CurrencySelector } from '@/shared/components/common/CurrencySelector';
import { LocaleSelector } from '@/shared/components/common/LocaleSelector';
import { RouteEditor } from './route-editor';
import { TripEditor, type Trip } from './trip-editor';

/**
 * The flight results page's toolbar — the hotel search page's bar
 * (`search-top-bar.tsx`), flights' version.
 *
 * Same plate, sizes and controls, built from the same parts: back on the left;
 * the route where the hotel bar has its place search, and the trip — dates,
 * travellers, cabin — where it has the stay; then filters, currency, language and
 * theme in the right corner, then the account — Sign in, or the avatar menu.
 * No map, so neither the view toggle nor nearby places. Like the hotel page it
 * stands in for the app header, so the currency, language and account controls
 * are always drawn: this bar is the only place on the page they can be reached from.
 */
export function FlightSearchTopBar({
    tone, barBackground, className,
    onBack,
    route, searching, trip,
    theme, onToggleTheme,
    filters,
}: Pick<SearchTopBarProps, 'tone' | 'barBackground' | 'className' | 'onBack' | 'theme' | 'onToggleTheme' | 'filters'> & {
    route: { origin: string; destination: string; onApply: (next: { origin: string; destination: string }) => void };
    searching: boolean;
    trip: Trip & { onApply: (next: Trip) => void };
}) {
    const tAll = useTranslations();
    const { chrome, rest } = barStyles(tone);

    return (
        <div
            // The phone bar takes less padding than the hotel bar's: it carries a
            // route — two airports and a swap — where that one has a single field,
            // and at the hotel bar's padding there was no width left to print them.
            className={cn(
                'flex h-12 items-center gap-1.5 rounded-[16px] p-3',
                'md:h-[60px] md:gap-2 md:rounded-[20px] md:p-8',
                className,
            )}
            style={{ background: barBackground ?? chrome.bar, boxShadow: chrome.shadow }}
        >
            <button onClick={onBack} aria-label={tAll('common.goBack')} className={ICON_BTN} style={rest}>
                <ArrowLeft size={13} className="md:size-[17px]" style={{ color: chrome.text }} />
            </button>

            <RouteEditor
                tone={tone}
                origin={route.origin}
                destination={route.destination}
                searching={searching}
                onApply={route.onApply}
            />

            {/* Dates, travellers and cabin, beside the route they belong to. */}
            <TripEditor tone={tone} {...trip} />

            <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
                {filters && <BarFiltersButton tone={tone} barBackground={barBackground} {...filters} />}
                <CurrencySelector chrome={chrome} iconOnly />
                <LocaleSelector chrome={chrome} iconOnly />
                <BarThemeButton tone={tone} theme={theme} onToggle={onToggleTheme} />
                <BarAccountButton tone={tone} />
            </div>
        </div>
    );
}
