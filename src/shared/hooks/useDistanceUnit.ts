'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useSearchStore } from '@/shared/stores/search.store';
import { guessDistanceUnit, type DistanceUnit } from '@/shared/lib/distance';

const subscribeNoop = () => () => {};

/**
 * False for the server render and the client's hydration render, true for every client render
 * after — including a component that mounts long after page load, which has no mismatch to avoid
 * and so should see the real unit straight away.
 */
function useAppHydrated(): boolean {
    return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/**
 * The distance unit in effect, and the setter for the viewer's choice.
 *
 * Their choice when they have made one, else a guess from the browser's region. Both live only in
 * the browser, so the server render and the hydration render use km and the real value lands
 * right after — no mismatch to warn about.
 */
export function useDistanceUnit(): [DistanceUnit, (unit: DistanceUnit) => void] {
    const chosen = useSearchStore((s) => s.distanceUnit);
    const setDistanceUnit = useSearchStore((s) => s.setDistanceUnit);
    const hydrated = useAppHydrated();

    const guessed = useMemo<DistanceUnit>(() => {
        if (!hydrated) return 'km';
        const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
        return guessDistanceUnit(languages);
    }, [hydrated]);

    return [hydrated ? (chosen ?? guessed) : 'km', setDistanceUnit];
}
