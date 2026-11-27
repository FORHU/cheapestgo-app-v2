'use client';

import { useQuery } from '@tanstack/react-query';
import { env } from '@/shared/lib/env';

/**
 * The destinations to offer before anything is typed.
 *
 * api-v2 builds these from `hotel_search_stats` — what people actually searched for in the
 * last fortnight — and tops the list up from `popular_destinations` when there is not enough
 * real signal yet. So this is demand, not an editorial list, and it needs no curation here.
 *
 * It lives in a hook because both pickers need it and there is only one right answer: the
 * stepper on the landing page and the destination field on the results page were drawing
 * different things from different places, which is how a visitor ends up being shown Seoul in
 * one and a photograph of Boracay in the other on the same visit.
 *
 * Half an hour of staleness, because the underlying counts move over days.
 */
export interface TrendingDestination {
    city:        string;
    countryCode: string;
    countryName: string;
    imageUrl:    string;
}

export function useTrendingDestinations(enabled = true) {
    return useQuery<TrendingDestination[]>({
        queryKey: ['trending-destinations'],
        queryFn: () =>
            fetch(`${env.NEXT_PUBLIC_API_URL}/hotels/trending`)
                .then(r => r.json())
                .then((res: { success: boolean; data: TrendingDestination[] }) =>
                    res.success ? res.data : []),
        staleTime: 30 * 60 * 1000,
        enabled,
    });
}
