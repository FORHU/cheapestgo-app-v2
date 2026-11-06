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
            // Two rows below `lg`, one from there up — the hotel bar's layout.
            //
            // On one row a phone had back, the route, the trip and five controls
            // across 360px, which left the route about 96px: two airport fields of
            // 30px each and a swap, with nothing legible in either. So under `lg`
            // the bar wraps — back, the route and the trip take the first row, and
            // the controls the second (see the cluster below).
            className={cn(
                'flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-[16px] p-2',
                'md:gap-x-2 md:rounded-[20px]',
                'lg:h-[60px] lg:flex-nowrap',
                'xl:p-8',
                className,
            )}
            style={{ background: barBackground ?? chrome.bar, boxShadow: chrome.shadow }}
        >
            <button onClick={onBack} aria-label={tAll('common.goBack')} className={ICON_BTN} style={rest}>
                <ArrowLeft size={16} className="md:size-[17px]" style={{ color: chrome.text }} />
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

            {/* Below `lg` the bar's whole second row (`basis-full` wraps it there):
                filters on the left under back, the session's currency, language,
                theme and account on the right — split by the spacer, as the hotel
                bar splits its own. */}
            <div className="flex basis-full items-center gap-1.5 md:gap-2 lg:ml-auto lg:basis-auto lg:shrink-0">
                {filters && <BarFiltersButton tone={tone} barBackground={barBackground} {...filters} />}
                <span aria-hidden="true" className="flex-1 lg:hidden" />
                <CurrencySelector chrome={chrome} iconOnly />
                <LocaleSelector chrome={chrome} iconOnly />
                <BarThemeButton tone={tone} theme={theme} onToggle={onToggleTheme} />
                <BarAccountButton tone={tone} />
            </div>
        </div>
    );
}
