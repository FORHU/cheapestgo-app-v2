'use client';

import { useEffect, useState } from 'react';

/**
 * False during SSR and on the first client render, true afterwards.
 *
 * Use it to gate anything read from a persisted (localStorage-backed) store
 * inside server-rendered markup: zustand's `persist` rehydrates synchronously,
 * so reading it during the first render can disagree with the HTML the server
 * sent and trip a hydration mismatch. Render the server-equivalent value first,
 * then switch once this flips.
 */
export function useHydrated(): boolean {
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => setHydrated(true), []);
    return hydrated;
}
