import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PoiCategory } from '@/shared/config/map-discovery';

vi.mock('@/shared/lib/env', () => ({
    env: { NEXT_PUBLIC_API_URL: 'http://api.test/api/v2', NEXT_PUBLIC_MAPBOX_TOKEN: undefined },
}));

import { useNearbyGems } from '@/features/hotels/hooks/useNearbyGems';

const HOTEL = { lat: 37.55, lng: 126.98 };

const feature = (id: string, name: string, rating: number) => ({
    type: 'Feature',
    geometry: { coordinates: [126.981, 37.551] },
    properties: { name, place_id: id, category: 'cafe', rating, source: 'google', photoReference: `ref-${id}` },
});

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function api(routes: {
    nearby: (url: URL) => Response | Promise<Response>;
    details?: (url: URL) => Response;
}) {
    const fn = vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/hotels/nearby')) return routes.nearby(url);
        if (url.pathname.endsWith('/photos/poi') && url.searchParams.get('full') === 'true') {
            return routes.details?.(url) ?? json({}, 404);
        }
        throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

const DETAILS = {
    name: 'Cafe Onion', nameEn: 'Cafe Onion (EN)', placeId: 'g-1', category: 'cafe', vicinity: '8 Achasan-ro',
    rating: 4.6, userRatingsTotal: 1200, reviews: [{ author_name: 'Min', rating: 5, text: 'Great bread' }],
    phone: '02-1234-5678', website: 'https://onion.example',
    openingHours: { open_now: true, weekday_text: ['Monday: 8 AM – 10 PM'] }, photoReference: 'ref', source: 'google',
};

afterEach(() => vi.unstubAllGlobals());

describe('useNearbyGems', () => {
    it('merges each place’s details into its gem', async () => {
        api({ nearby: () => json({ features: [feature('g-1', 'Cafe Onion', 4.5)] }), details: () => json(DETAILS) });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all' }));

        await waitFor(() => expect(result.current.gems[0]?.isStub).toBe(false));
        expect(result.current.gems[0]).toMatchObject({
            translatedName: 'Cafe Onion (EN)', phone: '02-1234-5678', website: 'https://onion.example',
            userRatingsTotal: 1200, vicinity: '8 Achasan-ro', rating: 4.6,
            openingHours: { open_now: true, weekday_text: ['Monday: 8 AM – 10 PM'] },
        });
        expect(result.current.gems[0].reviews).toHaveLength(1);
    });

    it('sends Google’s place id and photo reference for a Google place', async () => {
        const fetchMock = api({ nearby: () => json({ features: [feature('g-1', 'Cafe Onion', 4.5)] }), details: () => json(DETAILS) });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all' }));

        await waitFor(() => expect(result.current.gems[0]?.isStub).toBe(false));
        expect(result.current.gems[0].imageUrl).toContain('photo_reference=ref-g-1');
        const detailsCall = fetchMock.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname.endsWith('/photos/poi'));
        expect(detailsCall?.searchParams.get('placeId')).toBe('g-1');
    });

    it('drops a place its details rate under 3.5', async () => {
        api({
            nearby: () => json({ features: [feature('g-1', 'Cafe Onion', 4.5), feature('g-bad', 'Sad Diner', 4.0)] }),
            details: (url) => json(url.searchParams.get('placeId') === 'g-bad' ? { ...DETAILS, rating: 3.1 } : DETAILS),
        });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all' }));

        await waitFor(() => expect(result.current.gems.map((g) => g.name)).toEqual(['Cafe Onion']));
    });

    it('reports a failed lookup as an error, not as nothing nearby', async () => {
        api({ nearby: () => json({ error: 'upstream' }, 503) });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all' }));

        await waitFor(() => expect(result.current.error).toBe(true));
        expect(result.current.loading).toBe(false);
        expect(result.current.gems).toEqual([]);
    });

    it('fetches again on retry', async () => {
        let attempt = 0;
        api({
            nearby: () => (++attempt === 1 ? json({}, 503) : json({ features: [feature('g-1', 'Cafe Onion', 4.5)] })),
            details: () => json(DETAILS),
        });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all' }));
        await waitFor(() => expect(result.current.error).toBe(true));

        act(() => result.current.retry());

        await waitFor(() => expect(result.current.gems).toHaveLength(1));
        expect(result.current.error).toBe(false);
    });

    it('ignores a superseded category’s results', async () => {
        let releaseOld!: () => void;
        const oldGate = new Promise<void>((resolve) => { releaseOld = resolve; });
        api({
            nearby: async (url) => {
                if (url.searchParams.get('category') === 'all') {
                    await oldGate;
                    return json({ features: [feature('g-old', 'Old Place', 4.5)] });
                }
                return json({ features: [feature('g-new', 'New Place', 4.5)] });
            },
        });

        const { result, rerender } = renderHook(
            ({ category }: { category: PoiCategory }) => useNearbyGems({ coordinates: HOTEL, category }),
            { initialProps: { category: 'all' as PoiCategory } },
        );
        rerender({ category: 'restaurant' });

        await waitFor(() => expect(result.current.gems.map((g) => g.name)).toEqual(['New Place']));
        await act(async () => { releaseOld(); await new Promise((r) => setTimeout(r, 0)); });
        expect(result.current.gems.map((g) => g.name)).toEqual(['New Place']);
    });
});
