import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PoiCategory } from '@/shared/config/map-discovery';

const testEnv = vi.hoisted(() => ({
    NEXT_PUBLIC_API_URL: 'http://api.test/api/v2',
    NEXT_PUBLIC_MAPBOX_TOKEN: undefined as string | undefined,
}));
vi.mock('@/shared/lib/env', () => ({ env: testEnv }));

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
    details?: (url: URL) => Response | Promise<Response>;
    mapbox?: (url: URL) => Response;
}) {
    const fn = vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/hotels/nearby')) return routes.nearby(url);
        if (url.pathname.endsWith('/photos/poi') && url.searchParams.get('full') === 'true') {
            return routes.details?.(url) ?? json({}, 404);
        }
        if (url.hostname === 'api.mapbox.com' && routes.mapbox) return routes.mapbox(url);
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

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    testEnv.NEXT_PUBLIC_MAPBOX_TOKEN = undefined;
});

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

    it('with details "stubs", does not look up a Google place', async () => {
        const fetchMock = api({ nearby: () => json({ features: [feature('g-1', 'Cafe Onion', 4.5)] }), details: () => json(DETAILS) });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all', details: 'stubs' }));

        await waitFor(() => expect(result.current.gems).toHaveLength(1));
        await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
        const detailCalls = fetchMock.mock.calls.filter(([u]) => new URL(String(u)).searchParams.get('full') === 'true');
        expect(detailCalls).toHaveLength(0);
        expect(result.current.gems[0].isStub).toBe(false);
    });

    it('settles a gem whose details call fails', async () => {
        api({ nearby: () => json({ features: [feature('g-1', 'Cafe Onion', 4.5)] }), details: () => json({ error: 'x' }, 502) });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all' }));

        await waitFor(() => expect(result.current.gems[0]?.isStub).toBe(false));
        expect(result.current.gems[0]).toMatchObject({ name: 'Cafe Onion', rating: 4.5, category: 'cafe' });
        expect(result.current.gems[0].phone).toBeUndefined();
    });

    it('reports Mapbox failing everywhere, with nothing from Google, as an error', async () => {
        testEnv.NEXT_PUBLIC_MAPBOX_TOKEN = 'tok';
        api({ nearby: () => json({ features: [] }), mapbox: () => json({ message: 'unauthorized' }, 401) });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all' }));

        await waitFor(() => expect(result.current.error).toBe(true));
        expect(result.current.gems).toEqual([]);
        expect(result.current.loading).toBe(false);
    });

    it('flags an incomplete lookup as an error while still returning what Mapbox found', async () => {
        testEnv.NEXT_PUBLIC_MAPBOX_TOKEN = 'tok';
        api({
            nearby: () => json({}, 503),
            mapbox: () => json({ features: [{ geometry: { coordinates: [126.98, 37.55] }, properties: { name: 'Mapbox Cafe', mapbox_id: 'mb-1', category: 'cafe' } }] }),
            details: () => json({}, 502),
        });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all' }));

        await waitFor(() => expect(result.current.gems.length).toBeGreaterThan(0));
        expect(result.current.error).toBe(true);
    });

    it('ignores a superseded category’s details', async () => {
        let releaseOld!: () => void;
        const oldGate = new Promise<Response>((resolve) => { releaseOld = () => resolve(json(DETAILS)); });
        api({
            nearby: (url) => json({ features: [url.searchParams.get('category') === 'all'
                ? feature('g-old', 'Old Place', 4.5) : feature('g-new', 'New Place', 4.5)] }),
            details: (url) => (url.searchParams.get('name') === 'Old Place' ? oldGate : json({ ...DETAILS, name: 'New Place' })),
        });

        const { result, rerender } = renderHook(
            ({ category }: { category: PoiCategory }) => useNearbyGems({ coordinates: HOTEL, category }),
            { initialProps: { category: 'all' as PoiCategory } },
        );
        await waitFor(() => expect(result.current.gems.map((g) => g.name)).toEqual(['Old Place']));
        rerender({ category: 'restaurant' });
        await waitFor(() => expect(result.current.gems[0]?.name).toBe('New Place'));
        await waitFor(() => expect(result.current.gems[0]?.isStub).toBe(false));
        await act(async () => { releaseOld(); await new Promise((r) => setTimeout(r, 0)); });
        expect(result.current.gems.map((g) => g.name)).toEqual(['New Place']);
    });

    it('publishes finished details on a trailing flush without waiting for the slowest', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
        let releaseSlow!: () => void;
        const slowGate = new Promise<Response>((resolve) => { releaseSlow = () => resolve(json({ ...DETAILS, name: 'Slow' })); });
        api({
            nearby: () => json({ features: [feature('g-1', 'Fast One', 4.5), feature('g-2', 'Fast Two', 4.5), feature('g-3', 'Slow', 4.5)] }),
            details: (url) => (url.searchParams.get('name') === 'Slow' ? slowGate : json(DETAILS)),
        });

        const { result } = renderHook(() => useNearbyGems({ coordinates: HOTEL, category: 'all' }));
        await waitFor(() => expect(result.current.gems).toHaveLength(3));
        expect(result.current.gems.every((g) => g.isStub)).toBe(true);

        // Let the fast responses land; the trailing timer (800ms) is still pending, so nothing is published yet.
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        expect(result.current.gems.every((g) => g.isStub)).toBe(true);

        await act(async () => { await vi.advanceTimersByTimeAsync(900); });
        const byName = (n: string) => result.current.gems.find((g) => g.name === n);
        expect(byName('Fast One')?.isStub).toBe(false);
        expect(byName('Fast Two')?.isStub).toBe(false);
        expect(byName('Slow')?.isStub).toBe(true);

        await act(async () => { releaseSlow(); await vi.advanceTimersByTimeAsync(1000); });
        expect(result.current.gems.every((g) => !g.isStub)).toBe(true);
    });
});
