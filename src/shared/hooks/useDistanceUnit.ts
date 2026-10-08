'use client';

import { useMemo } from 'react';
import { useSearchStore } from '@/shared/stores/search.store';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { guessDistanceUnit, type DistanceUnit } from '@/shared/lib/distance';

/**
 * The distance unit in effect, and the setter for the viewer's choice.
 *
 * Their choice when they have made one, else a guess from the browser's region. Both live only in
 * the browser, so the server render and the first client render use km and the real value lands
 * on hydration — no mismatch to warn about.
 */
export function useDistanceUnit(): [DistanceUnit, (unit: DistanceUnit) => void] {
    const chosen = useSearchStore((s) => s.distanceUnit);
    const setDistanceUnit = useSearchStore((s) => s.setDistanceUnit);
    const hydrated = useHydrated();

    const guessed = useMemo<DistanceUnit>(() => {
        if (!hydrated) return 'km';
        const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
        return guessDistanceUnit(languages);
    }, [hydrated]);

    return [hydrated ? (chosen ?? guessed) : 'km', setDistanceUnit];
}
