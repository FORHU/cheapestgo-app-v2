'use client';

import { useEffect, useState } from 'react';
import { useUserCurrency } from '@/shared/stores/search.store';
import { fetchGolfCatalogue } from '@/features/golf/api/golf.api';
import type { GolfCourse } from '@/features/golf/types';

/**
 * Every published course, in the viewer's Display Currency, for the landing page's golf search:
 * `null` while asking, `[]` when there are none or api-v2 could not be reached. Asked again when
 * the currency changes; the browser never converts a fee itself (CONTEXT.md, "Display Currency").
 *
 * `enabled: false` asks nothing and answers `null` — for a sentence that was handed its courses.
 */
export function useGolfCourses(enabled = true): GolfCourse[] | null {
    const currency = useUserCurrency();
    const [courses, setCourses] = useState<GolfCourse[] | null>(null);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        setCourses(null);
        fetchGolfCatalogue({ currency })
            .then((catalogue) => { if (!cancelled) setCourses(catalogue.courses); })
            .catch(() => { if (!cancelled) setCourses([]); });
        return () => { cancelled = true; };
    }, [enabled, currency]);

    return courses;
}
