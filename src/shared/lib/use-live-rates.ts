'use client';

import { useSyncExternalStore } from 'react';
import { ratesAreLive, subscribeToRates } from '@/shared/lib/currency';

/**
 * Re-render when the exchange rates arrive.
 *
 * `EXCHANGE_RATES` is a module object mutated in place, so React has nothing to notice. Without
 * this, a page that rendered before the fetch came back kept its fallback prices until some
 * unrelated state change happened to re-render it — which on a search results page could be
 * never.
 *
 * The server snapshot is `false` on purpose: rates are fetched in the browser, so a server
 * render has none, and claiming otherwise would hydrate one set of prices over another.
 */
export function useLiveRates(): boolean {
    return useSyncExternalStore(subscribeToRates, ratesAreLive, () => false);
}
