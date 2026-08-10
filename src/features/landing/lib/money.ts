'use client';

import { useCallback } from 'react';
import { convertCurrency, getCurrencySymbol } from '@/shared/lib/currency';
import { useUserCurrency } from '@/shared/stores/search.store';
import { useHydrated } from '@/shared/hooks/useHydrated';

/**
 * Formats catalog/API prices into the currency the user picked in the header.
 *
 * The landing catalog is priced in PHP and the deals table can come back in any
 * currency, so every price on the page goes through here rather than hardcoding
 * a peso sign. Until hydration completes the price is shown in its source
 * currency — that is what the server rendered, and switching before then would
 * be a hydration mismatch on every price in the page.
 *
 * Callers render the result in JetBrains Mono: the design system reserves mono
 * for numbers so price columns line up.
 */
export function useMoney() {
    const userCurrency = useUserCurrency();
    const hydrated = useHydrated();

    return useCallback(
        (amount: number, from = 'PHP') => {
            const to = hydrated ? userCurrency : from;
            const rounded = Math.round(convertCurrency(amount, from, to));
            return `${getCurrencySymbol(to)}${rounded.toLocaleString('en-US')}`;
        },
        [userCurrency, hydrated]
    );
}
