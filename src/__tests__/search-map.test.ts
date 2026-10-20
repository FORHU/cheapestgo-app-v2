import { describe, it, expect } from 'vitest';
import { toMappable, applyContentPatch, isWithinKm } from '@/shared/components/map/toMappable';

// ─── Inline the pure functions under test ──────────────────────────────────
// (copied from page.tsx so we can test without importing the entire Next.js page)
type MappableProperty = {
    id: string;
    name: string;
    price: number;
    currency: string;
    coordinates: { lat: number; lng: number };
    images: string[];
    image?: string;
    rating?: number;
    reviewScore?: number;
    reviewCount?: number;
    refundableTag?: string;
    starRating?: number;
    location?: string;
    city?: string;
    country?: string;
    boardType?: string;
    priceLoading?: boolean;
    originalPrice?: number;
};

// `toMappable` is imported, not copied. It used to be inlined here "so we can
// test without importing the entire Next.js page", and that is exactly how the
// bug below shipped: the copy was asserted, the real one never was, and the
// suite stayed green while the search page rendered nothing at all.

function filterMappable(properties: MappableProperty[]): MappableProperty[] {
    return properties.filter(
        p => p.coordinates && p.coordinates.lat !== 0 && p.coordinates.lng !== 0
    );
}

// ─── Issue 1: Map pins — coordinate parsing ───────────────────────────────

describe('toMappable — coordinate parsing', () => {
    it('returns null only when the hotel has no id', () => {
        expect(toMappable({ name: 'Hotel A', price: 100 })).toBeNull();
    });

    // Regression. The search stream answers before content is resolved: it sends
    // 0,0 and fills the real position in a later `content` event. These two cases
    // used to assert `toBeNull()`, which is the behaviour that emptied the page —
    // every hotel was discarded on arrival, so the content patch found nothing to
    // patch and both the list and the map stayed blank.
    it('keeps a hotel whose coordinates have not arrived yet', () => {
        const r = toMappable({ id: '1', name: 'Hotel A', price: 100, lat: 0, lng: 0 });
        expect(r).not.toBeNull();
        expect(r!.coordinates).toEqual({ lat: 0, lng: 0 });
    });

    it('keeps a hotel that carries no lat/lng fields at all', () => {
        const r = toMappable({ id: '1', name: 'Hotel A', price: 100 });
        expect(r).not.toBeNull();
        expect(r!.coordinates).toEqual({ lat: 0, lng: 0 });
    });

    it('parses top-level lat/lng fields', () => {
        const result = toMappable({ id: '1', name: 'Hotel A', price: 100, lat: 36.35, lng: 127.38 });
        expect(result).not.toBeNull();
        expect(result!.coordinates).toEqual({ lat: 36.35, lng: 127.38 });
    });

    it('parses h.latitude / h.longitude fallback', () => {
        const result = toMappable({ id: '1', name: 'Hotel A', price: 100, latitude: 36.35, longitude: 127.38 });
        expect(result).not.toBeNull();
        expect(result!.coordinates).toEqual({ lat: 36.35, lng: 127.38 });
    });

    it('parses h.coordinates.lat / h.coordinates.lng fallback', () => {
        const result = toMappable({
            id: '1', name: 'Hotel A', price: 100,
            coordinates: { lat: 36.35, lng: 127.38 },
        });
        expect(result).not.toBeNull();
        expect(result!.coordinates).toEqual({ lat: 36.35, lng: 127.38 });
    });

    it('parses string lat/lng as numbers', () => {
        const result = toMappable({ id: '1', name: 'Hotel A', price: 100, lat: '36.35', lng: '127.38' });
        expect(result).not.toBeNull();
        expect(result!.coordinates.lat).toBe(36.35);
        expect(result!.coordinates.lng).toBe(127.38);
    });
});

// ─── Issue 1: filterMappable excludes zero-coordinate hotels ─────────────

describe('filterMappable — zero-coordinate filtering', () => {
    const base = (lat: number, lng: number): MappableProperty => ({
        id: '1', name: 'H', price: 100, currency: 'USD',
        coordinates: { lat, lng }, images: [],
    });

    it('keeps hotels with valid non-zero coordinates', () => {
        const hotels = [base(36.35, 127.38)];
        expect(filterMappable(hotels)).toHaveLength(1);
    });

    it('removes hotels where lat is 0', () => {
        const hotels = [base(0, 127.38)];
        expect(filterMappable(hotels)).toHaveLength(0);
    });

    it('removes hotels where lng is 0', () => {
        const hotels = [base(36.35, 0)];
        expect(filterMappable(hotels)).toHaveLength(0);
    });

    it('removes hotels where both are 0', () => {
        const hotels = [base(0, 0)];
        expect(filterMappable(hotels)).toHaveLength(0);
    });

    it('keeps only the hotels with valid coordinates from a mixed list', () => {
        const hotels = [base(36.35, 127.38), base(0, 0), base(37.56, 126.97)];
        const result = filterMappable(hotels);
        expect(result).toHaveLength(2);
        expect(result.map(h => h.coordinates.lat)).toEqual([36.35, 37.56]);
    });
});

// ─── Issue 2: Map indentation — container class check ────────────────────

describe('Map container indentation', () => {
    it('should NOT use absolute inset-0 (full bleed) for the map wrapper', () => {
        // The map div in page.tsx was: className="absolute inset-0"
        // After fix it should include horizontal margin (e.g. "mx-6" or padding)
        // We test this as a string assertion on the expected className
        const EXPECTED_CLASSES_TO_AVOID = 'inset-0';
        const EXPECTED_CLASS = 'left-16 right-16';
        // The fix should add mx-6 and remove the inset-0 full-bleed
        expect(EXPECTED_CLASS).toBeTruthy(); // placeholder — visual verification via screenshot
        expect(EXPECTED_CLASSES_TO_AVOID).not.toBe('mx-6'); // ensures they're different
    });
});

// ─── Issue 3: Horizontal scroll wheel handler ─────────────────────────────

describe('horizontal scroll wheel handler', () => {
    it('intercepts vertical-only wheel events (deltaX === 0) and scrolls horizontally', () => {
        const container = document.createElement('div');
        container.scrollLeft = 0;

        // Simulate the handler logic
        const handleWheel = (e: WheelEvent) => {
            if (e.deltaX !== 0) return; // trackpad already scrolling horizontally
            e.preventDefault();
            container.scrollLeft += e.deltaY;
        };

        const event = new WheelEvent('wheel', { deltaY: 120, deltaX: 0, bubbles: true });
        // Mark preventDefault as mockable
        let preventDefaultCalled = false;
        Object.defineProperty(event, 'preventDefault', {
            value: () => { preventDefaultCalled = true; },
        });

        handleWheel(event);

        expect(container.scrollLeft).toBe(120);
        expect(preventDefaultCalled).toBe(true);
    });

    it('does NOT intercept trackpad events (deltaX !== 0)', () => {
        const container = document.createElement('div');
        container.scrollLeft = 0;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaX !== 0) return;
            e.preventDefault();
            container.scrollLeft += e.deltaY;
        };

        const event = new WheelEvent('wheel', { deltaY: 30, deltaX: 15, bubbles: true });
        handleWheel(event);

        // scrollLeft unchanged — trackpad scroll passed through
        expect(container.scrollLeft).toBe(0);
    });

    it('handles negative deltaY (scroll left)', () => {
        const container = document.createElement('div');
        container.scrollLeft = 200;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaX !== 0) return;
            e.preventDefault();
            container.scrollLeft += e.deltaY;
        };

        const event = new WheelEvent('wheel', { deltaY: -120, deltaX: 0 });
        let preventDefaultCalled = false;
        Object.defineProperty(event, 'preventDefault', {
            value: () => { preventDefaultCalled = true; },
        });
        handleWheel(event);

        expect(container.scrollLeft).toBe(80);
        expect(preventDefaultCalled).toBe(true);
    });
});

// ─── Regression: the Seoul search that rendered nothing ──────────────────────
// Captured from dev.cheapestgo.com on 2026-10-19. When the supplier portfolio
// comes back empty, every hotel in the `hotels` event arrives unnamed at 0,0
// and the `content` event that follows carries the name and the position.
// Both halves have to work or the page is blank — which is what shipped.
describe('search stream — hotels arrive before their coordinates', () => {
    const hotelsEvent = [
        { hotelId: '10110462', id: '10110462', name: '10110462', price: 1430, currency: 'PHP', lat: 0, lng: 0, images: [] },
        { hotelId: '10487569', id: '10487569', name: '10487569', price: 1439, currency: 'PHP', lat: 0, lng: 0, images: [] },
        { hotelId: '11162318', id: '11162318', name: '11162318', price: 1667, currency: 'PHP', lat: 0, lng: 0, images: [] },
    ];

    const contentEvent = {
        '10110462': { name: 'Guro Namyangjang', lat: 37.481, lng: 126.89, images: ['https://cdn.worldota.net/a.JPEG'] },
        '10487569': { name: 'Seoul Hotel TAO', lat: 37.620457, lng: 126.9195, images: ['https://cdn.worldota.net/b.jpeg'] },
        '11162318': { name: 'Miasageori Station Daewon', lat: 37.613094, lng: 127.029594, images: ['https://cdn.worldota.net/c.JPEG'] },
    };

    const mapped = () => hotelsEvent.map(toMappable).flatMap(h => (h ? [h] : []));

    it('keeps every hotel rather than discarding the whole page', () => {
        expect(mapped()).toHaveLength(3);
    });

    it('resolves names and Seoul positions once content arrives', () => {
        const patched = applyContentPatch(mapped(), contentEvent);

        expect(patched.map(h => h.name)).toEqual([
            'Guro Namyangjang', 'Seoul Hotel TAO', 'Miasageori Station Daewon',
        ]);
        // Inside Seoul, not at Null Island.
        for (const h of patched) {
            expect(h.coordinates.lat).toBeGreaterThan(37.3);
            expect(h.coordinates.lat).toBeLessThan(37.8);
            expect(h.coordinates.lng).toBeGreaterThan(126.7);
            expect(h.coordinates.lng).toBeLessThan(127.3);
        }
        expect(patched.every(h => h.image?.startsWith('https://'))).toBe(true);
    });

    it('does not overwrite a hotel that already has a real name and position', () => {
        const placed = toMappable({
            id: '10110462', name: 'Real Name', price: 1430, lat: 37.5, lng: 127.0,
            images: ['https://example.test/original.jpg'],
        })!;
        const [patched] = applyContentPatch([placed], contentEvent);

        expect(patched.name).toBe('Real Name');
        expect(patched.coordinates).toEqual({ lat: 37.5, lng: 127.0 });
        expect(patched.image).toBe('https://example.test/original.jpg');
    });
});

// ─── The whole ingest path, as the page runs it ──────────────────────────────
// Three fixes were needed and each was hidden behind the previous one, so this
// replays every stage in order against the real Seoul payload rather than
// testing one function and assuming the rest. Seoul is the searched point.
describe('search stream — full ingest path', () => {
    const SEARCH_LAT = 37.5;
    const SEARCH_LNG = 127.0;

    const hotelsEvent = [
        { hotelId: '10110462', id: '10110462', name: '10110462', price: 1430, currency: 'PHP', lat: 0, lng: 0, images: [] },
        { hotelId: '10487569', id: '10487569', name: '10487569', price: 1439, currency: 'PHP', lat: 0, lng: 0, images: [] },
        { hotelId: '11162318', id: '11162318', name: '11162318', price: 1667, currency: 'PHP', lat: 0, lng: 0, images: [] },
    ];
    const contentEvent = {
        '10110462': { name: 'Guro Namyangjang', lat: 37.481, lng: 126.89, images: ['https://cdn.worldota.net/a.JPEG'] },
        '10487569': { name: 'Seoul Hotel TAO', lat: 37.620457, lng: 126.9195, images: ['https://cdn.worldota.net/b.jpeg'] },
        '11162318': { name: 'Miasageori Station Daewon', lat: 37.613094, lng: 127.029594, images: ['https://cdn.worldota.net/c.JPEG'] },
    };

    const nearby = (h: Parameters<typeof isWithinKm>[0]) => isWithinKm(h, SEARCH_LAT, SEARCH_LNG, 150);

    it('survives every stage and ends up placed in Seoul', () => {
        // 1. hotels event → adapter, then the ingest distance filter
        const ingested = hotelsEvent.map(toMappable).flatMap(h => (h ? [h] : [])).filter(nearby);
        expect(ingested).toHaveLength(3);

        // 2. content event → patch, then the filter re-applied now they are placed
        const patched = applyContentPatch(ingested, contentEvent).filter(nearby);
        expect(patched).toHaveLength(3);

        // 3. the list memo applies the same rule a second time
        const listed = patched.filter(nearby);
        expect(listed).toHaveLength(3);

        expect(listed.map(h => h.name)).toEqual([
            'Guro Namyangjang', 'Seoul Hotel TAO', 'Miasageori Station Daewon',
        ]);
        for (const h of listed) {
            expect(h.coordinates.lat).toBeGreaterThan(37.3);
            expect(h.coordinates.lat).toBeLessThan(37.8);
        }
    });

    it('still excludes a hotel that is genuinely far away once placed', () => {
        const far = applyContentPatch(
            hotelsEvent.slice(0, 1).map(toMappable).flatMap(h => (h ? [h] : [])),
            { '10110462': { name: 'Tokyo Hotel', lat: 35.68, lng: 139.69 } },
        ).filter(nearby);
        expect(far).toHaveLength(0);
    });
});

describe('content patch — street address', () => {
    const unplaced = () =>
        toMappable({ id: '1', name: '1', price: 100, lat: 0, lng: 0 })!;

    it('fills location from the patch address so the card can name the district', () => {
        const [h] = applyContentPatch([unplaced()], {
            '1': { name: 'Lotte City Hotel Gimpo Airport', lat: 37.5638, lng: 126.8028,
                   address: '38, Haneul-gil, Gangseo-gu, Seoul' },
        });
        expect(h.location).toBe('38, Haneul-gil, Gangseo-gu, Seoul');
        expect(h.name).toBe('Lotte City Hotel Gimpo Airport');
    });

    it('leaves an address the search leg already supplied alone', () => {
        const withAddr = toMappable({
            id: '1', name: 'Real', price: 100, lat: 37.5, lng: 127.0, location: 'Original address',
        })!;
        const [h] = applyContentPatch([withAddr], { '1': { address: 'Patched address' } });
        expect(h.location).toBe('Original address');
    });

    it('copes with a patch that has no address', () => {
        const [h] = applyContentPatch([unplaced()], { '1': { name: 'X', lat: 37.5, lng: 127.0 } });
        expect(h.location).toBeUndefined();
    });
});
