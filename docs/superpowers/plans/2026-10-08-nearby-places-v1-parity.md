# Nearby Places — V1 Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the V2 property page every nearby-places capability V1 has (place strip, routes, details popup, directions, trip planner, weather, fullscreen), plus a site-wide km/miles choice.

**Architecture:** api-v2's `/photos/poi` learns V1's place lookup (name → Google place → photo/details, Redis-cached). app-v2 replaces the property page's static `NearbySection` with `NearbyExplorer`, a container that owns state and composes small units under `features/hotels/components/nearby/`, fed by focused hooks. Distances go through one formatter driven by a persisted viewer preference.

**Tech Stack:** Express + Vitest + ioredis (api-v2); Next.js 15, React, react-map-gl/mapbox, next-intl, zustand, Vitest + Testing Library (app-v2); Google Places REST, Mapbox Directions & Optimization APIs.

**Spec:** `cheapestgo-app-v2/docs/superpowers/specs/2026-10-08-nearby-places-v1-parity-design.md`

---

## Conventions for every task

- Repos are siblings under `C:\Users\USER\Documents\GitHub\`: **`cheapestgo-api-v2`** and **`cheapestgo-app-v2`**. Paths below are relative to the repo named in each task.
- Every commit message ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commit only the files the task names (`git add <paths>`), never `git add -A`.
- Test commands: api-v2 `npx vitest run <file>`; app-v2 `npx vitest run <file>`.

## File map

**api-v2**
| File | Change | Responsibility |
|---|---|---|
| `src/lib/google/poi-details.ts` | create | Resolve a place via Google, cache it, fetch its photo, draw a placeholder |
| `src/routes/photos.route.ts` | modify | `/poi` answers name lookups and `full=true` |
| `src/__tests__/poiDetails.test.ts` | create | lookup behaviour |
| `src/__tests__/photosPoi.test.ts` | create | route behaviour |

**app-v2**
| File | Change | Responsibility |
|---|---|---|
| `src/features/hotels/hooks/useNearbyGems.ts` | modify | richer gems, `error`, `retry`, throttled enrichment |
| `src/shared/lib/distance.ts` | create | unit guess, formatting, radius steps, haversine |
| `src/shared/stores/search.store.ts` | modify | persisted `distanceUnit` |
| `src/shared/hooks/useDistanceUnit.ts` | create | the unit in effect (choice or guess) |
| `src/shared/components/common/DistanceUnitToggle.tsx` | create | km/mi switch |
| `src/locales/{en,ko,ja,zh}.json`, `NEEDS_NATIVE_REVIEW.md` | modify | `property.nearby.*` strings |
| `src/locales/__tests__/nearby-keys.test.ts` | create | key coverage |
| `src/features/hotels/components/nearby/types.ts` | create | shared types/constants |
| `src/features/hotels/components/nearby/links.ts` | create | Google Maps link |
| `src/features/hotels/components/nearby/opening-hours.ts` | create | group weekday hours |
| `src/features/hotels/components/nearby/map-bounds.ts` | create | fit map to points |
| `src/features/hotels/components/nearby/PlaceStrip.tsx` | create | cards + category/radius/unit controls |
| `src/features/hotels/components/nearby/PlaceDetailsModal.tsx` | create | details popup |
| `src/features/hotels/components/nearby/NearbyMap.tsx` | create | the map |
| `src/features/hotels/components/nearby/NearbyExplorer.tsx` | create | owns state, composes the rest |
| `src/features/hotels/components/nearby/PlaceCallout.tsx` | create | selected place + travel times |
| `src/features/hotels/components/nearby/DirectionsPanel.tsx` | create | origin search, locate me, mode |
| `src/features/hotels/components/nearby/TripPlannerBar.tsx` | create | stops, optimize, clear |
| `src/features/hotels/components/nearby/WeatherChip.tsx` | create | current weather + 3 days |
| `src/shared/components/mapbox/hooks/useMapboxDirections.ts` | create | route + per-mode minutes |
| `src/features/hotels/hooks/useOriginSearch.ts` | create | autocomplete, geocode, locate |
| `src/features/hotels/hooks/useTripPlanner.ts` | create | stops + Mapbox optimization |
| `src/features/hotels/hooks/useWeather.ts` | create | api-v2 weather, 15-min refresh |
| `src/features/hotels/components/property-view.tsx` | modify | mount `NearbyExplorer`, drop inline section |
| `src/shared/components/map/NearbyPlacePopup.tsx` | modify | unit-aware distance |
| `src/shared/components/mapbox/SearchMapContainer.tsx` | modify | unit-aware distance |
| `src/features/hotels/components/poi-discovery.tsx`, `nearby-section.tsx` | delete | unused |
| `CONTEXT.md` | modify | weather no longer deferred |

---

## Task 0: Isolated workspaces

app-v2 has uncommitted work in `room-selection` and all four locale files; this plan edits the locale files too. Work in worktrees so the two never mix.

- [ ] **Step 1: Create the worktrees**

Use superpowers:using-git-worktrees. Expected result:

```bash
cd C:/Users/USER/Documents/GitHub/cheapestgo-app-v2
git worktree add ../cheapestgo-app-v2-nearby -b feat/nearby-places feat/hotels-v2
cd ../cheapestgo-api-v2
git worktree add ../cheapestgo-api-v2-nearby -b feat/nearby-poi-details feat/hotel-v2
```

All later paths for app-v2 mean `cheapestgo-app-v2-nearby/`, for api-v2 `cheapestgo-api-v2-nearby/`.

- [ ] **Step 2: Install and baseline**

```bash
cd ../cheapestgo-api-v2-nearby && npm ci && npx vitest run
cd ../cheapestgo-app-v2-nearby && npm ci && npx vitest run
```

Expected: both suites pass (note any pre-existing failures in the task log before changing anything).

---

# Slice 1 — Place details lookup

## Task 1: api-v2 place-details library

**Repo:** api-v2
**Files:**
- Create: `src/lib/google/poi-details.ts`
- Test: `src/__tests__/poiDetails.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/poiDetails.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock('@/config', () => ({ config: { GOOGLE_PLACES_API_KEY: 'test-key' } }));
vi.mock('@/lib/redis', () => ({
    redis: {
        get:   vi.fn(async (k: string) => store.get(k) ?? null),
        setex: vi.fn(async (k: string, _ttl: number, v: string) => { store.set(k, v); return 'OK'; }),
    },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { lookupPoiDetails, placeholderSvg, poiCacheKey } from '@/lib/google/poi-details';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

type Reply = Record<string, unknown>;

/** Answers each Google URL with the first rule whose fragment it contains. */
function google(rules: Array<[string, Reply]>) {
    const fn = vi.fn(async (input: string | URL) => {
        const url = String(input);
        const rule = rules.find(([fragment]) => url.includes(fragment));
        if (!rule) throw new Error(`unexpected fetch ${url}`);
        return new Response(JSON.stringify(rule[1]), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

const CAFE = {
    place_id: 'g-cafe',
    name: 'Cafe Onion',
    types: ['cafe', 'food'],
    vicinity: '8 Achasan-ro',
    rating: 4.6,
    user_ratings_total: 1200,
    formatted_phone_number: '02-1234-5678',
    website: 'https://onion.example',
    opening_hours: { open_now: true, weekday_text: ['Monday: 8:00 AM – 10:00 PM'] },
    photos: [{ photo_reference: 'ref-cafe' }],
    reviews: [{ author_name: 'Min', rating: 5, text: 'Great bread' }],
};

const AT = { name: 'Cafe Onion', lat: 37.5, lng: 127.0 };

beforeEach(() => { store.clear(); vi.clearAllMocks(); });
afterEach(() => vi.unstubAllGlobals());

describe('lookupPoiDetails', () => {
    it('uses Place Details directly when given a place id', async () => {
        const fetchMock = google([['details/json?place_id=g-cafe', { status: 'OK', result: CAFE }]]);

        const d = await lookupPoiDetails({ ...AT, placeId: 'g-cafe' });

        expect(d).toMatchObject({
            placeId: 'g-cafe', nameEn: 'Cafe Onion', category: 'cafe', vicinity: '8 Achasan-ro',
            rating: 4.6, userRatingsTotal: 1200, phone: '02-1234-5678', website: 'https://onion.example',
            photoReference: 'ref-cafe', source: 'google',
        });
        expect(d.reviews).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).not.toContain('nearbysearch');
    });

    it('tries name-search candidates in order and stops at the first with a photo or reviews', async () => {
        const fetchMock = google([
            ['nearbysearch', { status: 'OK', results: [{ place_id: 'g-bare' }, { place_id: 'g-cafe' }, { place_id: 'g-third' }] }],
            ['place_id=g-bare', { status: 'OK', result: { place_id: 'g-bare', name: 'Onion Annex' } }],
            ['place_id=g-cafe', { status: 'OK', result: CAFE }],
        ]);

        const d = await lookupPoiDetails(AT);

        expect(d.placeId).toBe('g-cafe');
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('also caches a name lookup under the place id it resolved to', async () => {
        google([
            ['nearbysearch', { status: 'OK', results: [{ place_id: 'g-cafe' }] }],
            ['place_id=g-cafe', { status: 'OK', result: CAFE }],
        ]);

        await lookupPoiDetails(AT);

        expect(store.has(poiCacheKey(AT))).toBe(true);
        expect(store.has('poi|g-cafe')).toBe(true);
    });

    it('falls back to a name search when the id is not a Google place id', async () => {
        google([
            ['place_id=dXJuOm1ieHBvaQ', { status: 'INVALID_REQUEST' }],
            ['nearbysearch', { status: 'OK', results: [{ place_id: 'g-cafe' }] }],
            ['place_id=g-cafe', { status: 'OK', result: CAFE }],
        ]);

        const d = await lookupPoiDetails({ ...AT, placeId: 'dXJuOm1ieHBvaQ' });

        expect(d.placeId).toBe('g-cafe');
    });

    it('gives a station with no hours "Open 24 hours"', async () => {
        google([['place_id=g-stn', { status: 'OK', result: { place_id: 'g-stn', name: 'Seoul Station', types: ['train_station'] } }]]);

        const d = await lookupPoiDetails({ name: 'Seoul Station', lat: 37.55, lng: 126.97, placeId: 'g-stn', category: 'train_station' });

        expect(d.openingHours).toEqual({ open_now: true, weekday_text: ['Open 24 hours'] });
    });

    it('does not treat a parking lot as a park', async () => {
        google([['place_id=g-lot', { status: 'OK', result: { place_id: 'g-lot', name: 'Lot 7', types: ['parking'] } }]]);

        const d = await lookupPoiDetails({ name: 'Lot 7', lat: 37.5, lng: 127, placeId: 'g-lot', category: 'parking' });

        expect(d.openingHours).toBeNull();
    });

    it('leaves a missing rating missing', async () => {
        google([['place_id=g-new', { status: 'OK', result: { place_id: 'g-new', name: 'New Spot', photos: [{ photo_reference: 'r' }] } }]]);

        const d = await lookupPoiDetails({ ...AT, placeId: 'g-new' });

        expect(d.rating).toBeNull();
        expect(d.userRatingsTotal).toBeNull();
    });

    it('returns an empty result, and caches it, when Google finds nothing', async () => {
        google([['nearbysearch', { status: 'ZERO_RESULTS', results: [] }]]);

        const d = await lookupPoiDetails(AT);

        expect(d).toMatchObject({ name: 'Cafe Onion', placeId: null, rating: null, reviews: [], source: 'none' });
        expect(redis.setex).toHaveBeenCalled();
    });

    it('answers from the cache without calling Google', async () => {
        const cached = { name: 'Cafe Onion', nameEn: 'Cafe Onion', placeId: 'g-cafe', category: 'cafe', vicinity: null, rating: 4.6, userRatingsTotal: 3, reviews: [], phone: null, website: null, openingHours: null, photoReference: null, source: 'google' };
        store.set(poiCacheKey({ ...AT, placeId: 'g-cafe' }), JSON.stringify(cached));
        const fetchMock = google([]);

        const d = await lookupPoiDetails({ ...AT, placeId: 'g-cafe' });

        expect(d).toEqual(cached);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shares one Google call between concurrent identical lookups', async () => {
        const fetchMock = google([['place_id=g-cafe', { status: 'OK', result: CAFE }]]);

        const [a, b] = await Promise.all([
            lookupPoiDetails({ ...AT, placeId: 'g-cafe' }),
            lookupPoiDetails({ ...AT, placeId: 'g-cafe' }),
        ]);

        expect(a).toEqual(b);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failure, so the next request tries again', async () => {
        const fetchMock = google([['nearbysearch', { status: 'OVER_QUERY_LIMIT' }]]);

        await expect(lookupPoiDetails(AT)).rejects.toThrow('OVER_QUERY_LIMIT');
        expect(redis.setex).not.toHaveBeenCalled();

        await expect(lookupPoiDetails(AT)).rejects.toThrow('OVER_QUERY_LIMIT');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('logs a denied key loudly', async () => {
        google([['nearbysearch', { status: 'REQUEST_DENIED' }]]);

        await expect(lookupPoiDetails(AT)).rejects.toThrow('REQUEST_DENIED');
        expect(logger.error).toHaveBeenCalled();
    });
});

describe('placeholderSvg', () => {
    it('escapes the name and colours by category', () => {
        const svg = placeholderSvg('A & <B>', 'park');
        expect(svg).toContain('A &amp; &lt;B&gt;');
        expect(svg).toContain('#064e3b');
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/__tests__/poiDetails.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/google/poi-details"`.

- [ ] **Step 3: Implement**

`src/lib/google/poi-details.ts`:

```ts
/**
 * One nearby place, resolved through Google Places — v1's /api/poi-photo, ported.
 *
 * The property page's nearby strip draws cards from two sources: Google's nearby search, which
 * gives a place id, and Mapbox's category search, which gives only a name and a point. Both come
 * here for a photo, opening hours, phone, website and reviews.
 *
 * "Nothing found" is an answer and is cached; a Google error is not, so a passing outage does not
 * stick to a place for a day.
 */

import { config } from '@/config';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

export interface PoiReview {
    author_name: string;
    rating: number;
    text: string;
    relative_time_description?: string;
    profile_photo_url?: string;
}

export interface PoiOpeningHours {
    open_now?: boolean;
    weekday_text?: string[];
}

export interface PoiDetails {
    name: string;
    nameEn: string | null;
    placeId: string | null;
    category: string | null;
    vicinity: string | null;
    rating: number | null;
    userRatingsTotal: number | null;
    reviews: PoiReview[];
    phone: string | null;
    website: string | null;
    openingHours: PoiOpeningHours | null;
    photoReference: string | null;
    source: 'google' | 'none';
}

export interface PoiLookup {
    name: string;
    lat: number;
    lng: number;
    /** Google's id when the caller has one. A Mapbox id is tolerated: it falls back to a name search. */
    placeId?: string;
    category?: string;
}

interface GooglePlace {
    place_id?: string;
    name?: string;
    types?: string[];
    vicinity?: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: PoiReview[];
    formatted_phone_number?: string;
    website?: string;
    opening_hours?: PoiOpeningHours;
    photos?: { photo_reference?: string }[];
}

const GOOGLE = 'https://maps.googleapis.com/maps/api/place';
const TTL_SECONDS = 86_400;
const MAX_REVIEWS = 5;
const CANDIDATES = 3;
const DETAILS_FIELDS = [
    'place_id', 'name', 'types', 'vicinity', 'formatted_address', 'rating', 'user_ratings_total',
    'reviews', 'formatted_phone_number', 'website', 'opening_hours', 'photos',
].join(',');

/** Statuses meaning "there is nothing here", as opposed to "something went wrong". */
const EMPTY_STATUSES = new Set(['ZERO_RESULTS', 'NOT_FOUND', 'INVALID_REQUEST']);

/** Places that are never shut, when Google sends no hours for them. Word-bounded so "parking" is not a park. */
const ALWAYS_OPEN = /\b(transit|station|park|nature)\b/;

const inFlight = new Map<string, Promise<PoiDetails>>();

export function poiCacheKey(q: PoiLookup): string {
    return q.placeId
        ? `poi|${q.placeId}`
        : `poi|${q.name.toLowerCase()}|${q.lat.toFixed(4)}|${q.lng.toFixed(4)}`;
}

function apiKey(): string {
    const key = config.GOOGLE_PLACES_API_KEY;
    if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    return key;
}

async function callGoogle<T>(url: string): Promise<{ status: string; body: T }> {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Google Places HTTP ${res.status}`);
    const body = await res.json() as T & { status: string };
    if (body.status === 'REQUEST_DENIED') {
        logger.error('[poi-details] Google REQUEST_DENIED — check the Places API key and billing');
    }
    if (body.status !== 'OK' && !EMPTY_STATUSES.has(body.status)) {
        throw new Error(`Google Places status ${body.status}`);
    }
    return { status: body.status, body };
}

async function placeDetails(placeId: string, key: string): Promise<GooglePlace | null> {
    const { status, body } = await callGoogle<{ result?: GooglePlace }>(
        `${GOOGLE}/details/json?place_id=${encodeURIComponent(placeId)}&fields=${DETAILS_FIELDS}&language=en&key=${key}`,
    );
    return status === 'OK' ? body.result ?? null : null;
}

async function candidatesNear(q: PoiLookup, key: string): Promise<GooglePlace[]> {
    const { status, body } = await callGoogle<{ results?: GooglePlace[] }>(
        `${GOOGLE}/nearbysearch/json?location=${q.lat},${q.lng}&radius=500&keyword=${encodeURIComponent(q.name)}&language=en&key=${key}`,
    );
    return status === 'OK' ? (body.results ?? []).slice(0, CANDIDATES) : [];
}

function emptyDetails(q: PoiLookup): PoiDetails {
    return {
        name: q.name, nameEn: null, placeId: null, category: null, vicinity: null, rating: null,
        userRatingsTotal: null, reviews: [], phone: null, website: null, openingHours: null,
        photoReference: null, source: 'none',
    };
}

function withDefaultHours(d: PoiDetails, q: PoiLookup): PoiDetails {
    if (d.openingHours) return d;
    const category = `${q.category ?? ''} ${d.category ?? ''}`.replace(/_/g, ' ').toLowerCase();
    const alwaysOpen = ALWAYS_OPEN.test(category) || /\bstation\b/i.test(q.name);
    return alwaysOpen ? { ...d, openingHours: { open_now: true, weekday_text: ['Open 24 hours'] } } : d;
}

function toDetails(p: GooglePlace, q: PoiLookup): PoiDetails {
    return withDefaultHours({
        name: q.name,
        nameEn: p.name ?? null,
        placeId: p.place_id ?? null,
        category: p.types?.[0]?.replace(/_/g, ' ') ?? null,
        vicinity: p.vicinity ?? p.formatted_address ?? null,
        rating: typeof p.rating === 'number' ? p.rating : null,
        userRatingsTotal: typeof p.user_ratings_total === 'number' ? p.user_ratings_total : null,
        reviews: (p.reviews ?? []).slice(0, MAX_REVIEWS),
        phone: p.formatted_phone_number ?? null,
        website: p.website ?? null,
        openingHours: p.opening_hours
            ? { open_now: p.opening_hours.open_now, weekday_text: p.opening_hours.weekday_text }
            : null,
        photoReference: p.photos?.[0]?.photo_reference ?? null,
        source: 'google',
    }, q);
}

async function resolve(q: PoiLookup): Promise<PoiDetails> {
    const key = apiKey();
    if (q.placeId) {
        const place = await placeDetails(q.placeId, key);
        if (place) return toDetails(place, q);
    }
    // One candidate at a time: the first with a photo or reviews wins, so a good match costs one
    // Details call rather than three fired in parallel and two thrown away.
    for (const candidate of await candidatesNear(q, key)) {
        if (!candidate.place_id) continue;
        const place = await placeDetails(candidate.place_id, key);
        if (place && (place.photos?.length || place.reviews?.length)) return toDetails(place, q);
    }
    return withDefaultHours(emptyDetails(q), q);
}

export function lookupPoiDetails(q: PoiLookup): Promise<PoiDetails> {
    const cacheKey = poiCacheKey(q);
    const pending = inFlight.get(cacheKey);
    if (pending) return pending;

    const lookup = (async () => {
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) {
            try { return JSON.parse(cached) as PoiDetails; } catch { /* corrupt entry: look it up again */ }
        }
        const details = await resolve(q);
        const value = JSON.stringify(details);
        await redis.setex(cacheKey, TTL_SECONDS, value).catch(() => {});
        if (details.placeId && details.placeId !== q.placeId) {
            await redis.setex(`poi|${details.placeId}`, TTL_SECONDS, value).catch(() => {});
        }
        return details;
    })().finally(() => inFlight.delete(cacheKey));

    inFlight.set(cacheKey, lookup);
    return lookup;
}

export async function fetchPlacePhoto(photoReference: string, maxWidth = 800): Promise<{ body: Buffer; contentType: string }> {
    const key = apiKey();
    const res = await fetch(
        `${GOOGLE}/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${key}`,
        { signal: AbortSignal.timeout(8000) },
    );
    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok || !contentType.startsWith('image/')) throw new Error(`Google photo HTTP ${res.status}`);
    return { body: Buffer.from(await res.arrayBuffer()), contentType };
}

/** The card a place without a photo gets: its name on a category colour. */
export function placeholderSvg(name: string, category: string): string {
    const cat = category.toLowerCase();
    const lowerName = name.toLowerCase();
    let bg = '#1e293b';
    if (cat.includes('park') || cat.includes('nature') || lowerName.includes('park') || lowerName.includes('garden')) bg = '#064e3b';
    else if (cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe')) bg = '#7c2d12';
    else if (cat.includes('museum') || cat.includes('landmark') || cat.includes('attraction') || cat.includes('tourism') || cat.includes('tourist')) bg = '#3730a3';
    else if (cat.includes('shop') || cat.includes('market')) bg = '#831843';
    else if (cat.includes('transit') || cat.includes('station')) bg = '#334155';
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const label = escape(name.length > 24 ? `${name.slice(0, 22)}…` : name);
    const sub = escape(cat.replace(/_/g, ' ') || 'point of interest');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="${bg}"/><text x="300" y="185" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="600" fill="rgba(255,255,255,0.9)">${label}</text><text x="300" y="220" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="rgba(255,255,255,0.5)">${sub}</text></svg>`;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/__tests__/poiDetails.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/poi-details.ts src/__tests__/poiDetails.test.ts
git commit -m "feat(photos): resolve a nearby place's photo and details through Google

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 2: api-v2 `/photos/poi` route

**Repo:** api-v2
**Files:**
- Modify: `src/routes/photos.route.ts` (imports at lines 9-11; the `/poi` registration at line 50)
- Test: `src/__tests__/photosPoi.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/photosPoi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/config', () => ({ config: { GOOGLE_PLACES_API_KEY: 'test-key' } }));
vi.mock('@/lib/google/poi-details', () => ({
    lookupPoiDetails: vi.fn(),
    fetchPlacePhoto:  vi.fn(),
    placeholderSvg:   vi.fn(() => '<svg>placeholder</svg>'),
}));

import { poiPhotoOrDetails } from '@/routes/photos.route';
import { lookupPoiDetails, fetchPlacePhoto, type PoiDetails } from '@/lib/google/poi-details';
import { AppError } from '@/middleware/error.middleware';

const DETAILS: PoiDetails = {
    name: 'Cafe Onion', nameEn: 'Cafe Onion', placeId: 'g-cafe', category: 'cafe', vicinity: null,
    rating: 4.6, userRatingsTotal: 10, reviews: [], phone: null, website: null, openingHours: null,
    photoReference: 'ref-cafe', source: 'google',
};

function fakeRes() {
    return {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as unknown,
        status(code: number) { this.statusCode = code; return this; },
        set(h: Record<string, string>) { Object.assign(this.headers, h); return this; },
        json(b: unknown) { this.body = b; return this; },
        send(b: unknown) { this.body = b; return this; },
    };
}

async function call(query: Record<string, string>) {
    const res = fakeRes();
    const next = vi.fn();
    await poiPhotoOrDetails({ query } as never, res as never, next);
    return { res, next };
}

const PLACE = { name: 'Cafe Onion', lat: '37.5', lng: '127' };

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('GET /photos/poi', () => {
    it('answers full=true with the place details', async () => {
        vi.mocked(lookupPoiDetails).mockResolvedValue(DETAILS);

        const { res, next } = await call({ ...PLACE, placeId: 'g-cafe', full: 'true' });

        expect(next).not.toHaveBeenCalled();
        expect(res.body).toEqual(DETAILS);
        expect(lookupPoiDetails).toHaveBeenCalledWith({ name: 'Cafe Onion', lat: 37.5, lng: 127, placeId: 'g-cafe', category: undefined });
    });

    it('passes a failed details lookup on as an error, not as an empty place', async () => {
        const failure = new Error('Google Places status OVER_QUERY_LIMIT');
        vi.mocked(lookupPoiDetails).mockRejectedValue(failure);

        const { res, next } = await call({ ...PLACE, full: 'true' });

        expect(next).toHaveBeenCalledWith(failure);
        expect(res.body).toBeUndefined();
    });

    it('streams the resolved photo', async () => {
        vi.mocked(lookupPoiDetails).mockResolvedValue(DETAILS);
        vi.mocked(fetchPlacePhoto).mockResolvedValue({ body: Buffer.from('jpg'), contentType: 'image/jpeg' });

        const { res } = await call(PLACE);

        expect(fetchPlacePhoto).toHaveBeenCalledWith('ref-cafe');
        expect(res.headers['Content-Type']).toBe('image/jpeg');
        expect(res.body).toEqual(Buffer.from('jpg'));
    });

    it('draws a cacheable placeholder for a place with no photo', async () => {
        vi.mocked(lookupPoiDetails).mockResolvedValue({ ...DETAILS, photoReference: null });

        const { res } = await call({ ...PLACE, category: 'cafe' });

        expect(res.headers['Content-Type']).toBe('image/svg+xml');
        expect(res.headers['Cache-Control']).toBe('public, max-age=86400');
        expect(res.body).toBe('<svg>placeholder</svg>');
    });

    it('draws an uncached placeholder when the lookup fails', async () => {
        vi.mocked(lookupPoiDetails).mockRejectedValue(new Error('down'));

        const { res, next } = await call(PLACE);

        expect(next).not.toHaveBeenCalled();
        expect(res.headers['Content-Type']).toBe('image/svg+xml');
        expect(res.headers['Cache-Control']).toBe('no-store');
    });

    it('rejects a lookup with no name', async () => {
        const { next } = await call({ lat: '37.5', lng: '127', full: 'true' });

        expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
        expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it('rejects a lookup with no coordinates', async () => {
        const { next } = await call({ name: 'Cafe Onion' });

        expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it('still proxies a bare photo_reference', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from('img'), { headers: { 'content-type': 'image/jpeg' } })));

        const { res } = await call({ photo_reference: 'ref-x' });

        expect(lookupPoiDetails).not.toHaveBeenCalled();
        expect(res.body).toEqual(Buffer.from('img'));
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/__tests__/photosPoi.test.ts`
Expected: FAIL — `poiPhotoOrDetails is not a function`.

- [ ] **Step 3: Implement**

In `src/routes/photos.route.ts`, add to the imports (after line 11):

```ts
import { lookupPoiDetails, fetchPlacePhoto, placeholderSvg } from '@/lib/google/poi-details';
```

Add above `router.get('/place', proxyGooglePhoto);`:

```ts
/** A query value as a finite number, or null. An empty string is missing, not zero. */
function coordinate(value: unknown): number | null {
    if (typeof value !== 'string' || value.trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function sendPlaceholder(res: Response, name: string, category: string | undefined, cacheControl: string) {
    res.set({ 'Content-Type': 'image/svg+xml', 'Cache-Control': cacheControl });
    return res.send(placeholderSvg(name, category ?? ''));
}

/**
 * GET /api/v2/photos/poi — a nearby place's photo, or with `full=true` its details.
 *
 *   ?photo_reference=                                 → that photo, proxied
 *   ?name=&lat=&lng=[&placeId=&category=]             → the resolved place's photo, else an SVG card
 *   ?name=&lat=&lng=[&placeId=&category=]&full=true   → PoiDetails JSON
 *
 * v1 answered all three at /api/poi-photo. v2 only had the first, so every card without a photo
 * reference 400'd and the nearby strip's details step never ran.
 */
export async function poiPhotoOrDetails(req: Request, res: Response, next: NextFunction) {
    const full = req.query.full === 'true';
    const photoReference = typeof req.query.photo_reference === 'string' ? req.query.photo_reference : '';
    if (photoReference && !full) return proxyGooglePhoto(req, res, next);

    try {
        const name = typeof req.query.name === 'string' ? req.query.name.trim() : '';
        if (!name) throw new AppError(400, 'Missing name', 'VALIDATION_ERROR');
        const lat = coordinate(req.query.lat);
        const lng = coordinate(req.query.lng);
        if (lat === null || lng === null) throw new AppError(400, 'Missing or invalid lat/lng', 'VALIDATION_ERROR');

        const lookup = {
            name,
            lat,
            lng,
            placeId:  typeof req.query.placeId === 'string' && req.query.placeId ? req.query.placeId : undefined,
            category: typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined,
        };

        if (full) return res.json(await lookupPoiDetails(lookup));

        // Image mode always answers with a picture — the card has to show something — but one
        // drawn because something failed must not be kept by the browser.
        let photoReferenceFound: string | null;
        try {
            photoReferenceFound = (await lookupPoiDetails(lookup)).photoReference;
        } catch {
            return sendPlaceholder(res, name, lookup.category, 'no-store');
        }
        if (!photoReferenceFound) return sendPlaceholder(res, name, lookup.category, 'public, max-age=86400');

        try {
            const photo = await fetchPlacePhoto(photoReferenceFound);
            res.set({ 'Content-Type': photo.contentType, 'Cache-Control': 'public, max-age=86400' });
            return res.send(photo.body);
        } catch {
            return sendPlaceholder(res, name, lookup.category, 'no-store');
        }
    } catch (err) {
        next(err);
    }
}
```

Replace line 50:

```ts
router.get('/poi',   proxyGooglePhoto);
```

with:

```ts
router.get('/poi',   poiPhotoOrDetails);
```

Update the file's header comment line for `/poi` to:

```ts
 * GET /api/v2/photos/poi?name=&lat=&lng=[&full=true]                  — nearby place photo / details
```

- [ ] **Step 4: Run to verify they pass, plus the suite and type-check**

```bash
npx vitest run src/__tests__/photosPoi.test.ts src/__tests__/poiDetails.test.ts
npm run type-check
npm run lint
```

Expected: tests PASS (8 + 13), no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/photos.route.ts src/__tests__/photosPoi.test.ts
git commit -m "feat(photos): /photos/poi answers name lookups and full=true details

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 3: app-v2 `useNearbyGems` — richer gems, error, retry

**Repo:** app-v2
**Files:**
- Modify (full replacement): `src/features/hotels/hooks/useNearbyGems.ts`
- Test: `src/features/hotels/__tests__/useNearbyGems.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/features/hotels/__tests__/useNearbyGems.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/useNearbyGems.test.tsx`
Expected: FAIL — Google places are never enriched (`isStub` stays `false` from the start but `phone` is undefined), `error`/`retry` are undefined.

- [ ] **Step 3: Implement**

Replace `src/features/hotels/hooks/useNearbyGems.ts` entirely:

```ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Landmark, Trees, Utensils, Pill, ShoppingBasket, Bus, Search,
} from 'lucide-react';
import { env } from '@/shared/lib/env';
import type { PoiCategory } from '@/shared/config/map-discovery';
import { isAbortError } from '@/shared/lib/error';

/**
 * A POI from either upstream — the app's own nearby endpoint or the Mapbox
 * fallback the hook falls back to when that returns too few. Everything is
 * optional because the two disagree about which fields they send.
 */
interface PoiFeature {
    type?: string;
    geometry?: { coordinates?: [number, number] };
    properties?: {
        name?: string;
        category?: string;
        place_id?: string;
        mapbox_id?: string;
        photoReference?: string;
        isStub?: boolean;
        source?: string;
        rating?: number | null;
        userRatingsTotal?: number;
        vicinity?: string;
        [key: string]: unknown;
    };
}

export interface PoiReview {
    author_name: string;
    rating: number;
    text: string;
    relative_time_description?: string;
    profile_photo_url?: string;
}

export interface PoiOpeningHours {
    open_now?: boolean;
    weekday_text?: string[];
}

/** What api-v2's `/photos/poi?full=true` answers with. */
interface PoiDetailsResponse {
    nameEn?: string | null;
    category?: string | null;
    vicinity?: string | null;
    rating?: number | string | null;
    userRatingsTotal?: number | null;
    reviews?: PoiReview[];
    phone?: string | null;
    website?: string | null;
    openingHours?: PoiOpeningHours | null;
}

export interface NearbyGem {
    id: string;
    /** Google's place id. Set only for places that came from Google — a Mapbox id is not one. */
    placeId?: string;
    name: string;
    /** Google's English name for the place, when it differs from the local one. */
    translatedName?: string;
    category: string;
    displayCategory?: string;
    rating: number | null;
    userRatingsTotal?: number | null;
    vicinity?: string | null;
    reviews?: PoiReview[];
    phone?: string | null;
    website?: string | null;
    openingHours?: PoiOpeningHours | null;
    source?: string;
    imageUrl: string;
    icon: React.ElementType;
    coordinates: { lat: number; lng: number };
    /** Still waiting on its details. */
    isStub: boolean;
}

interface UseNearbyGemsProps {
    coordinates?: { lat: number; lng: number };
    category: PoiCategory;
    radiusMeters?: number;
}

/** Below this, a place is dropped once its details arrive (v1's bar). */
const MIN_RATING = 3.5;
/** Enrichment publishes at most this often, plus once at the end — not once per place. */
const FLUSH_MS = 800;

const pLimit = (limit: number) => {
    let active = 0;
    const queue: (() => void)[] = [];
    const next = () => { if (queue.length > 0 && active < limit) { active++; queue.shift()!(); } };
    return <T,>(fn: () => Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
            const run = () => fn().then(resolve, reject).finally(() => { active--; next(); });
            queue.push(run);
            next();
        });
};

export function categoryToIcon(cat: string) {
    const c = cat.toLowerCase();
    if (c.includes('restaurant') || c.includes('cafe') || c.includes('food') || c.includes('bar')) return Utensils;
    if (c.includes('park') || c.includes('garden') || c.includes('nature')) return Trees;
    if (c.includes('hospital') || c.includes('pharmacy') || c.includes('medical')) return Pill;
    if (c.includes('supermarket') || c.includes('grocery') || c.includes('shop')) return ShoppingBasket;
    if (c.includes('bus') || c.includes('station') || c.includes('transit')) return Bus;
    if (c.includes('museum') || c.includes('attraction') || c.includes('landmark')) return Landmark;
    return Search;
}

export function categoryToBg(cat: string) {
    const c = cat.toLowerCase();
    if (c.includes('park') || c.includes('garden') || c.includes('nature')) return 'from-emerald-800 to-emerald-950';
    if (c.includes('restaurant') || c.includes('cafe') || c.includes('food') || c.includes('bar')) return 'from-orange-700 to-orange-950';
    if (c.includes('museum') || c.includes('tourist') || c.includes('landmark') || c.includes('attraction')) return 'from-indigo-700 to-indigo-950';
    if (c.includes('shop') || c.includes('market') || c.includes('supermarket')) return 'from-pink-700 to-pink-950';
    if (c.includes('transit') || c.includes('station') || c.includes('bus') || c.includes('train')) return 'from-slate-600 to-slate-900';
    if (c.includes('hospital') || c.includes('pharmacy') || c.includes('medical')) return 'from-blue-700 to-blue-950';
    return 'from-slate-700 to-slate-950';
}

function toGem(f: PoiFeature, apiBase: string): NearbyGem {
    const name = f.properties?.name ?? '';
    const category = f.properties?.category ?? '';
    const [lng, lat] = f.geometry?.coordinates ?? [0, 0];
    const source = f.properties?.source ?? 'mapbox';
    const placeId = source === 'google' ? f.properties?.place_id : undefined;
    const photoRef = f.properties?.photoReference ?? '';

    const qs = new URLSearchParams({ name, lat: String(lat), lng: String(lng) });
    if (placeId)  qs.set('placeId', placeId);
    if (category) qs.set('category', category);
    if (photoRef) qs.set('photo_reference', photoRef);

    return {
        id:               f.properties?.place_id || name,
        placeId,
        name,
        category,
        rating:           f.properties?.rating ?? null,
        userRatingsTotal: typeof f.properties?.userRatingsTotal === 'number' ? f.properties.userRatingsTotal : null,
        vicinity:         typeof f.properties?.vicinity === 'string' ? f.properties.vicinity : null,
        source,
        imageUrl:         `${apiBase}/photos/poi?${qs.toString()}`,
        icon:             categoryToIcon(category),
        coordinates:      { lat, lng },
        isStub:           true,
    };
}

/** One place's details folded into the list — or the place dropped, if they rate it too low. */
export function mergeDetails(gems: NearbyGem[], id: string, d: PoiDetailsResponse): NearbyGem[] {
    // The endpoint sends this as a string sometimes; coerce once, here.
    const rating = d.rating != null ? Number(d.rating) : null;
    if (rating !== null && rating < MIN_RATING) return gems.filter((g) => g.id !== id);
    return gems.map((g) => g.id !== id ? g : {
        ...g,
        translatedName:   d.nameEn ?? g.translatedName,
        displayCategory:  d.category ?? g.displayCategory,
        vicinity:         d.vicinity ?? g.vicinity,
        rating:           rating ?? g.rating,
        userRatingsTotal: d.userRatingsTotal ?? g.userRatingsTotal,
        reviews:          d.reviews?.length ? d.reviews : g.reviews,
        phone:            d.phone ?? g.phone,
        website:          d.website ?? g.website,
        openingHours:     d.openingHours ?? g.openingHours,
        isStub:           false,
    });
}

async function enrich(
    initial: NearbyGem[],
    apiBase: string,
    signal: AbortSignal,
    publish: (gems: NearbyGem[]) => void,
) {
    const limiter = pLimit(3);
    let buffer = [...initial];
    let lastFlush = Date.now();
    const flush = (force: boolean) => {
        if (signal.aborted) return;
        if (force || Date.now() - lastFlush >= FLUSH_MS) {
            publish([...buffer]);
            lastFlush = Date.now();
        }
    };

    await Promise.all(initial.map((gem) => limiter(async () => {
        if (signal.aborted) return;
        try {
            const qs = new URLSearchParams({
                name: gem.name,
                lat:  String(gem.coordinates.lat),
                lng:  String(gem.coordinates.lng),
                full: 'true',
            });
            if (gem.placeId)  qs.set('placeId', gem.placeId);
            if (gem.category) qs.set('category', gem.category);
            const res = await fetch(`${apiBase}/photos/poi?${qs.toString()}`, { signal });
            if (!res.ok) return;
            buffer = mergeDetails(buffer, gem.id, await res.json() as PoiDetailsResponse);
            flush(false);
        } catch {
            /* one place's details failing leaves its card as it was */
        }
    })));
    flush(true);
}

export function useNearbyGems({ coordinates, category, radiusMeters = 3000 }: UseNearbyGemsProps) {
    const [gems, setGems]       = useState<NearbyGem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(false);
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    // Callers build `coordinates` inline, so the effect keys off the two
    // primitives instead of the object — depending on its identity would
    // refetch on every render.
    const lat = coordinates?.lat;
    const lng = coordinates?.lng;

    useEffect(() => {
        if (!lat || !lng) return;

        const controller = new AbortController();
        const { signal } = controller;
        const apiBase = env.NEXT_PUBLIC_API_URL;

        const run = async () => {
            setLoading(true);
            setError(false);
            setGems([]);

            try {
                // Stage 1: Google Places via the V2 API. A failure here is reported, not
                // presented as an empty neighbourhood — but Stage 2 still runs, so whatever
                // Mapbox has still shows.
                let features: PoiFeature[] = [];
                try {
                    const res = await fetch(
                        `${apiBase}/hotels/nearby?lat=${lat}&lng=${lng}&category=${category}&radius=${radiusMeters}`,
                        { signal },
                    );
                    if (res.ok) features = ((await res.json()) as { features?: PoiFeature[] }).features ?? [];
                    else if (!signal.aborted) setError(true);
                } catch (e) {
                    if (isAbortError(e)) return;
                    setError(true);
                }

                // Stage 2: Mapbox fallback when Google returns sparse results
                if (features.length < 5 && env.NEXT_PUBLIC_MAPBOX_TOKEN) {
                    const mbCats: Record<string, string[]> = {
                        all:        ['tourism', 'restaurant', 'park'],
                        restaurant: ['restaurant', 'cafe'],
                        cafe:       ['coffee', 'cafe'],
                        attraction: ['park', 'museum'],
                        grocery:    ['grocery_store', 'supermarket'],
                        medical:    ['hospital', 'pharmacy'],
                        transit:    ['bus_station', 'train_station'],
                    };
                    const cats = mbCats[category] ?? ['tourism'];

                    const mbResults = await Promise.all(
                        cats.map((cat) =>
                            fetch(
                                `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(cat)}?access_token=${env.NEXT_PUBLIC_MAPBOX_TOKEN}&language=en&limit=15&proximity=${lng},${lat}`,
                                { signal },
                            ).then((r) => r.json()).catch(() => ({ features: [] })),
                        ),
                    );

                    const seen = new Set(features.map((f) => f.properties?.name));
                    for (const mb of mbResults) {
                        for (const f of (mb.features ?? [])) {
                            const name = f.properties?.name;
                            if (name && !seen.has(name)) {
                                seen.add(name);
                                features.push({
                                    type: 'Feature',
                                    geometry: f.geometry,
                                    properties: {
                                        name,
                                        place_id: f.properties?.mapbox_id ?? name,
                                        category: f.properties?.category ?? category,
                                        rating:   null,
                                        source:   'mapbox',
                                    },
                                });
                            }
                        }
                    }
                }

                if (signal.aborted) return;
                if (features.length === 0) { setLoading(false); return; }

                const initialGems = features.slice(0, 25).map((f) => toGem(f, apiBase));
                setGems(initialGems);
                setLoading(false);

                // Stage 3: details for every place, published in batches
                await enrich(initialGems, apiBase, signal, setGems);
            } catch (e) {
                if (!isAbortError(e)) {
                    console.error('[useNearbyGems]', e);
                    setError(true);
                }
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        };

        run();
        return () => controller.abort();
    }, [lat, lng, category, radiusMeters, attempt]);

    return { gems, loading, error, retry };
}
```

- [ ] **Step 4: Run the tests, the search-map tests, and type-check**

```bash
npx vitest run src/features/hotels/__tests__/useNearbyGems.test.tsx src/shared/components/map/__tests__
npm run type-check
```

Expected: PASS; no type errors (the search map still compiles — the new fields are optional and `gems`/`loading` are unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/features/hotels/hooks/useNearbyGems.ts src/features/hotels/__tests__/useNearbyGems.test.tsx
git commit -m "feat(nearby): enrich every place with details; report lookup failures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 4: Slice 1 browser check

- [ ] **Step 1: Run both servers**

```bash
# api-v2 worktree (port 4000)
npm run dev
# app-v2 worktree (port 3001 — 3000 is v1's Docker container)
npx next dev --turbo --port 3001
```

- [ ] **Step 2: Hit the endpoint directly**

```bash
curl -s "http://localhost:4000/api/v2/photos/poi?name=Gyeongbokgung%20Palace&lat=37.5796&lng=126.977&full=true"
curl -s -o NUL -w "%{content_type}\n" "http://localhost:4000/api/v2/photos/poi?name=Gyeongbokgung%20Palace&lat=37.5796&lng=126.977"
```

Expected: the first prints JSON with `"source":"google"`, a `rating`, `reviews`; the second prints `image/jpeg` (or `image/svg+xml` if Google has no photo). A second run of the first command returns instantly (Redis).

- [ ] **Step 3: Note the result in the task log.** No commit.

---

# Slice 2 — Distance units, the explorer, the strip, the details popup

## Task 5: `shared/lib/distance.ts`

**Repo:** app-v2
**Files:**
- Create: `src/shared/lib/distance.ts`
- Test: `src/shared/lib/__tests__/distance.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/shared/lib/__tests__/distance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    guessDistanceUnit, formatDistance, RADIUS_OPTIONS, nearestRadius, haversineMeters,
} from '@/shared/lib/distance';

describe('guessDistanceUnit', () => {
    it.each([
        [['en-US'], 'mi'],
        [['en-GB'], 'mi'],
        [['ko-KR'], 'km'],
        [['en'], 'km'],
        [['en', 'en-US'], 'mi'],
        [['ja-JP', 'en-US'], 'km'],
        [[], 'km'],
        [['not a tag!!'], 'km'],
    ])('%j → %s', (languages, unit) => {
        expect(guessDistanceUnit(languages)).toBe(unit);
    });
});

describe('formatDistance', () => {
    it.each([
        [990, 'km', '990 m'],
        [995, 'km', '1 km'],
        [1234, 'km', '1.2 km'],
        [144.8, 'mi', '480 ft'],
        [160.9344, 'mi', '0.1 mi'],
        [1609.344, 'mi', '1 mi'],
    ] as const)('%d m in %s → %s', (meters, unit, text) => {
        expect(formatDistance(meters, unit, 'en')).toBe(text);
    });

    it('localises the number and unit', () => {
        expect(formatDistance(1234, 'km', 'ko')).toContain('1.2');
    });
});

describe('RADIUS_OPTIONS', () => {
    it('are round numbers in each unit', () => {
        expect(RADIUS_OPTIONS.km.map((m) => formatDistance(m, 'km', 'en'))).toEqual(['1 km', '2 km', '5 km', '10 km']);
        expect(RADIUS_OPTIONS.mi.map((m) => formatDistance(m, 'mi', 'en'))).toEqual(['0.5 mi', '1 mi', '3 mi', '5 mi']);
    });
});

describe('nearestRadius', () => {
    it.each([
        [2000, 'mi', 1609],
        [1609, 'km', 2000],
        [8047, 'km', 10000],
        [805, 'km', 1000],
    ] as const)('%d m snaps to %d in %s', (meters, unit, expected) => {
        expect(nearestRadius(meters, unit)).toBe(expected);
    });
});

describe('haversineMeters', () => {
    it('measures a short north–south hop', () => {
        expect(Math.round(haversineMeters({ lat: 37.55, lng: 126.98 }, { lat: 37.5532, lng: 126.98 }))).toBe(356);
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/shared/lib/__tests__/distance.test.ts`
Expected: FAIL — cannot resolve `@/shared/lib/distance`.

- [ ] **Step 3: Implement**

`src/shared/lib/distance.ts`:

```ts
/**
 * Distances as the viewer reads them — kilometres or miles.
 *
 * The one place a distance becomes text. Every surface that shows one (the property page's nearby
 * places, the search map's place popups) formats through here, so a viewer who picks miles sees
 * miles everywhere rather than on whichever screens remembered to ask.
 */

export type DistanceUnit = 'km' | 'mi';

/** Where miles are the everyday unit for road distances. */
const MILES_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;
const EARTH_RADIUS_M = 6_371_000;

/**
 * The unit to start a viewer on, from their browser's languages: the first tag that names a region
 * decides. A bare `en` names none, so it does not count as American.
 */
export function guessDistanceUnit(languages: readonly string[]): DistanceUnit {
    for (const tag of languages) {
        let region: string | undefined;
        try {
            region = new Intl.Locale(tag).region;
        } catch {
            continue;
        }
        if (region) return MILES_REGIONS.has(region) ? 'mi' : 'km';
    }
    return 'km';
}

function unitFormat(locale: string, value: number, unit: 'meter' | 'kilometer' | 'foot' | 'mile', digits: number) {
    return new Intl.NumberFormat(locale, {
        style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: digits,
    }).format(value);
}

/**
 * `meters` as text: metres under a kilometre, feet under a tenth of a mile, otherwise one decimal.
 * Short distances round to 10 — "350 m", not "347 m" — which is all a walk needs.
 */
export function formatDistance(meters: number, unit: DistanceUnit, locale = 'en'): string {
    if (unit === 'km') {
        const rounded = Math.round(meters / 10) * 10;
        return rounded < 1000
            ? unitFormat(locale, rounded, 'meter', 0)
            : unitFormat(locale, meters / 1000, 'kilometer', 1);
    }
    const miles = meters / METERS_PER_MILE;
    return miles < 0.1
        ? unitFormat(locale, Math.round((meters * FEET_PER_METER) / 10) * 10, 'foot', 0)
        : unitFormat(locale, miles, 'mile', 1);
}

/** Search-radius steps, in metres, that read as round numbers in each unit. */
export const RADIUS_OPTIONS: Record<DistanceUnit, readonly number[]> = {
    km: [1000, 2000, 5000, 10000],
    mi: [805, 1609, 4828, 8047],
};

/** The step in `unit` closest to `meters` — where the radius lands when the unit flips. */
export function nearestRadius(meters: number, unit: DistanceUnit): number {
    return RADIUS_OPTIONS[unit].reduce((best, step) =>
        Math.abs(step - meters) < Math.abs(best - meters) ? step : best);
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/shared/lib/__tests__/distance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/distance.ts src/shared/lib/__tests__/distance.test.ts
git commit -m "feat(distance): format distances in km or miles from one place

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 6: Persisted unit preference + `useDistanceUnit`

**Repo:** app-v2
**Files:**
- Modify: `src/shared/stores/search.store.ts`
- Create: `src/shared/hooks/useDistanceUnit.ts`
- Test: `src/shared/hooks/__tests__/useDistanceUnit.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/shared/hooks/__tests__/useDistanceUnit.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useDistanceUnit } from '@/shared/hooks/useDistanceUnit';
import { useSearchStore } from '@/shared/stores/search.store';

/** jsdom's `navigator.languages` lives on the prototype; shadow it on the instance per test. */
function browserLanguages(languages: string[]) {
    Object.defineProperty(navigator, 'languages', { configurable: true, get: () => languages });
}

beforeEach(() => {
    localStorage.clear();
    useSearchStore.setState({ distanceUnit: null });
});
afterEach(() => { Reflect.deleteProperty(navigator, 'languages'); });

describe('useDistanceUnit', () => {
    it('guesses miles for a US browser', () => {
        browserLanguages(['en-US']);
        const { result } = renderHook(() => useDistanceUnit());
        expect(result.current[0]).toBe('mi');
    });

    it('guesses kilometres for a Korean browser', () => {
        browserLanguages(['ko-KR']);
        const { result } = renderHook(() => useDistanceUnit());
        expect(result.current[0]).toBe('km');
    });

    it('prefers the viewer’s choice over the guess and remembers it', () => {
        browserLanguages(['en-US']);
        const { result } = renderHook(() => useDistanceUnit());

        act(() => result.current[1]('km'));

        expect(result.current[0]).toBe('km');
        const saved = JSON.parse(localStorage.getItem('cheapestgo-search-v2') ?? '{}');
        expect(saved.state.distanceUnit).toBe('km');
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/shared/hooks/__tests__/useDistanceUnit.test.ts`
Expected: FAIL — cannot resolve `@/shared/hooks/useDistanceUnit`.

- [ ] **Step 3: Add the preference to the store**

In `src/shared/stores/search.store.ts`:

Add after the `persist` import (line 3):

```ts
import type { DistanceUnit } from '@/shared/lib/distance';
```

In `interface SearchState`, under `userCountry: string;`:

```ts
    /** km or miles, as the viewer picked. `null` until they pick — the browser region decides till then. */
    distanceUnit: DistanceUnit | null;
```

Under `setUserCountry: (c: string) => void;`:

```ts
    setDistanceUnit: (u: DistanceUnit) => void;
```

In the store body, under `userCountry: 'KR',`:

```ts
            distanceUnit: null,
```

Under `setUserCountry: (userCountry) => set({ userCountry }),`:

```ts
            setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
```

In `partialize`, under `userCountry: s.userCountry,`:

```ts
                distanceUnit: s.distanceUnit,
```

In `useSearchActions`, under `setUserCountry: state.setUserCountry,`:

```ts
            setDistanceUnit: state.setDistanceUnit,
```

- [ ] **Step 4: Create the hook**

`src/shared/hooks/useDistanceUnit.ts`:

```ts
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
```

- [ ] **Step 5: Run to verify they pass; check the store's other tests**

```bash
npx vitest run src/shared/hooks/__tests__/useDistanceUnit.test.ts src/shared/stores
npm run type-check
```

Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/stores/search.store.ts src/shared/hooks/useDistanceUnit.ts src/shared/hooks/__tests__/useDistanceUnit.test.ts
git commit -m "feat(distance): remember the viewer's km/miles choice, guess it until then

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 7: `DistanceUnitToggle`

**Repo:** app-v2
**Files:**
- Create: `src/shared/components/common/DistanceUnitToggle.tsx`
- Test: `src/shared/components/common/__tests__/DistanceUnitToggle.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/shared/components/common/__tests__/DistanceUnitToggle.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DistanceUnitToggle } from '@/shared/components/common/DistanceUnitToggle';

const COLORS = { muted: '#64748b', border: '#e2e8f0', activeBg: '#2563eb', activeFg: '#fff' };

describe('DistanceUnitToggle', () => {
    it('marks the current unit and reports a switch', () => {
        const onChange = vi.fn();
        render(<DistanceUnitToggle value="km" onChange={onChange} label="Distance unit" colors={COLORS} />);

        expect(screen.getByRole('radiogroup', { name: 'Distance unit' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'km' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'mi' })).toHaveAttribute('aria-checked', 'false');

        fireEvent.click(screen.getByRole('radio', { name: 'mi' }));
        expect(onChange).toHaveBeenCalledWith('mi');
    });

    it('ignores a click on the unit already chosen', () => {
        const onChange = vi.fn();
        render(<DistanceUnitToggle value="km" onChange={onChange} label="Distance unit" colors={COLORS} />);

        fireEvent.click(screen.getByRole('radio', { name: 'km' }));
        expect(onChange).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/shared/components/common/__tests__/DistanceUnitToggle.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Implement**

`src/shared/components/common/DistanceUnitToggle.tsx`:

```tsx
'use client';

import type { DistanceUnit } from '@/shared/lib/distance';

export interface DistanceUnitToggleColors {
    muted: string;
    border: string;
    activeBg: string;
    activeFg: string;
}

interface DistanceUnitToggleProps {
    value: DistanceUnit;
    onChange: (unit: DistanceUnit) => void;
    /** Accessible name for the group, e.g. "Distance unit". */
    label: string;
    /** Taken from the caller's palette, so the pill sits in whatever theme its page draws. */
    colors: DistanceUnitToggleColors;
}

const UNITS: readonly DistanceUnit[] = ['km', 'mi'];

/** km | mi. The abbreviations read the same in every language the site serves, so they are not translated. */
export function DistanceUnitToggle({ value, onChange, label, colors }: DistanceUnitToggleProps) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 999, border: `1px solid ${colors.border}` }}
        >
            {UNITS.map((unit) => {
                const active = unit === value;
                return (
                    <button
                        key={unit}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => { if (!active) onChange(unit); }}
                        style={{
                            padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                            fontSize: 13, fontWeight: 700,
                            background: active ? colors.activeBg : 'transparent',
                            color: active ? colors.activeFg : colors.muted,
                            transition: 'background .15s, color .15s',
                        }}
                    >
                        {unit}
                    </button>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/shared/components/common/__tests__/DistanceUnitToggle.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/common/DistanceUnitToggle.tsx src/shared/components/common/__tests__/DistanceUnitToggle.test.tsx
git commit -m "feat(distance): km | mi toggle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 8: `property.nearby` messages in four languages

All strings the explorer needs, added once, so later tasks never touch the locale files. Existing keys reused: `property.mapOverlay.{viewOnMaps,recenterMap,fullscreen,exitFullscreen,layers}`, `property.poiDetails.{openingHours,openNow,closed,googleReviews,noReviews}`, `hotels.nearby.none`, `property.v2.loadingNearby`.

**Repo:** app-v2
**Files:**
- Modify: `src/locales/en.json`, `ko.json`, `ja.json`, `zh.json`, `src/locales/NEEDS_NATIVE_REVIEW.md`
- Test: `src/locales/__tests__/nearby-keys.test.ts`

- [ ] **Step 1: Write the failing test**

`src/locales/__tests__/nearby-keys.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import en from '../en.json';
import ko from '../ko.json';
import ja from '../ja.json';
import zh from '../zh.json';

/**
 * The nearby-places explorer reads these in every language the storefront serves. A missing key
 * falls back to English mid-sentence, so coverage is asserted here; wording of the strings v1 never
 * had is listed in NEEDS_NATIVE_REVIEW.md for a native speaker.
 */

type Messages = Record<string, unknown>;
const LANGS: Array<[string, Messages]> = [['ko', ko], ['ja', ja], ['zh', zh]];

const read = (messages: Messages, path: string): unknown =>
    path.split('.').reduce<unknown>(
        (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
        messages,
    );

const leaves = (node: unknown, prefix: string): string[] =>
    node && typeof node === 'object'
        ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => leaves(v, `${prefix}.${k}`))
        : [prefix];

const NEARBY = leaves(read(en, 'property.nearby'), 'property.nearby');

const REUSED = [
    'property.mapOverlay.viewOnMaps', 'property.mapOverlay.recenterMap', 'property.mapOverlay.fullscreen',
    'property.mapOverlay.exitFullscreen', 'property.mapOverlay.layers',
    'property.poiDetails.openingHours', 'property.poiDetails.openNow', 'property.poiDetails.closed',
    'property.poiDetails.googleReviews', 'property.poiDetails.noReviews',
    'hotels.nearby.none', 'property.v2.loadingNearby',
];

describe('nearby messages', () => {
    it('exist in English', () => {
        expect(NEARBY.length).toBeGreaterThan(40);
    });

    it.each([...NEARBY, ...REUSED])('%s exists in English', (path) => {
        expect(read(en, path)).toBeTypeOf('string');
    });

    describe.each(LANGS)('%s', (_lang, messages) => {
        it.each([...NEARBY, ...REUSED])('%s', (path) => {
            expect(read(messages, path)).toBeTypeOf('string');
        });
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/locales/__tests__/nearby-keys.test.ts`
Expected: FAIL — `property.nearby` is undefined.

- [ ] **Step 3: Write the one-off insertion script**

The locale files' exact formatting does not survive a parse-and-rewrite, so the block is inserted as text. Create `scripts/add-nearby-messages.mjs` (deleted in Step 5, never committed):

```js
// One-off: adds property.nearby to every locale and lists the new strings for native review.
import fs from 'node:fs';

const MESSAGES = {
    en: {
        hotel: 'Hotel',
        categoryLabel: 'Place type',
        radiusLabel: 'Search radius',
        unitLabel: 'Distance unit',
        categories: { all: 'All', restaurant: 'Dining', cafe: 'Cafés', attraction: 'Attractions & Parks', grocery: 'Groceries', medical: 'Hospitals & Health', transit: 'Transit' },
        loadFailed: "Couldn't load nearby places.",
        retry: 'Try again',
        details: 'Details',
        close: 'Close',
        scrollLeft: 'Scroll left',
        scrollRight: 'Scroll right',
        away: '{distance} away',
        fromHotel: '{distance} from the hotel',
        reviewsCount: '{count, plural, one {# review} other {# reviews}}',
        call: 'Call',
        website: 'Website',
        googleMaps: 'Google Maps',
        drive: 'Drive',
        walk: 'Walk',
        bike: 'Bike',
        traffic: 'Live traffic',
        travelMode: 'Travel mode',
        minutes: '{count} min',
        loadingRoute: 'Finding a route…',
        routeUnavailable: 'Route unavailable',
        addToTrip: 'Add to trip',
        removeFromTrip: 'Remove from trip',
        trip: {
            title: 'Your trip · {count}/{max}',
            optimize: 'Optimize route',
            optimizing: 'Optimizing…',
            clear: 'Clear',
            max: 'You can plan up to {max} stops.',
            failed: "Couldn't optimize this route.",
            summary: '{minutes} min round trip from the hotel',
        },
        directions: {
            open: 'Get directions',
            close: 'Hide directions',
            whereFrom: 'Where from?',
            locateMe: 'Use my location',
            locating: 'Locating…',
            locationDenied: "Couldn't get your location. Type a starting point instead.",
            searchFailed: "Couldn't search places. Try again.",
            toHotel: '{minutes} min to the hotel',
        },
        weather: { feelsLike: 'Feels like {temp}', highLow: '{high} / {low}' },
    },
    ko: {
        hotel: '호텔',
        categoryLabel: '장소 유형',
        radiusLabel: '검색 반경',
        unitLabel: '거리 단위',
        categories: { all: '전체', restaurant: '식당', cafe: '카페', attraction: '관광명소 & 공원', grocery: '식료품점', medical: '병원 & 건강', transit: '대중교통' },
        loadFailed: '주변 장소를 불러오지 못했습니다.',
        retry: '다시 시도',
        details: '상세 정보',
        close: '닫기',
        scrollLeft: '왼쪽으로 스크롤',
        scrollRight: '오른쪽으로 스크롤',
        away: '{distance} 거리',
        fromHotel: '호텔에서 {distance}',
        reviewsCount: '{count, plural, other {리뷰 #개}}',
        call: '전화',
        website: '웹사이트',
        googleMaps: 'Google 지도',
        drive: '자동차',
        walk: '도보',
        bike: '자전거',
        traffic: '실시간 교통',
        travelMode: '이동 수단',
        minutes: '{count}분',
        loadingRoute: '경로를 찾는 중…',
        routeUnavailable: '경로를 찾을 수 없음',
        addToTrip: '일정에 추가',
        removeFromTrip: '일정에서 삭제',
        trip: {
            title: '내 일정 · {count}/{max}',
            optimize: '경로 최적화',
            optimizing: '최적화 중…',
            clear: '모두 지우기',
            max: '최대 {max}곳까지 계획할 수 있습니다.',
            failed: '경로를 최적화하지 못했습니다.',
            summary: '호텔 출발 왕복 {minutes}분',
        },
        directions: {
            open: '길찾기',
            close: '길찾기 닫기',
            whereFrom: '출발지는 어디인가요?',
            locateMe: '내 위치 사용',
            locating: '위치 확인 중…',
            locationDenied: '위치를 가져올 수 없습니다. 출발지를 직접 입력해 주세요.',
            searchFailed: '장소를 검색하지 못했습니다. 다시 시도해 주세요.',
            toHotel: '호텔까지 {minutes}분',
        },
        weather: { feelsLike: '체감 {temp}', highLow: '{high} / {low}' },
    },
    ja: {
        hotel: 'ホテル',
        categoryLabel: 'スポットの種類',
        radiusLabel: '検索範囲',
        unitLabel: '距離の単位',
        categories: { all: 'すべて', restaurant: '食事', cafe: 'カフェ', attraction: '観光スポット & 公園', grocery: '食料品', medical: '病院 & 健康', transit: '交通機関' },
        loadFailed: '周辺スポットを読み込めませんでした。',
        retry: '再試行',
        details: '詳細',
        close: '閉じる',
        scrollLeft: '左へスクロール',
        scrollRight: '右へスクロール',
        away: '{distance}先',
        fromHotel: 'ホテルから{distance}',
        reviewsCount: '{count, plural, other {#件のレビュー}}',
        call: '電話',
        website: 'ウェブサイト',
        googleMaps: 'Google マップ',
        drive: '車',
        walk: '徒歩',
        bike: '自転車',
        traffic: 'リアルタイム交通',
        travelMode: '移動手段',
        minutes: '{count}分',
        loadingRoute: 'ルートを検索中…',
        routeUnavailable: 'ルートが見つかりません',
        addToTrip: '旅程に追加',
        removeFromTrip: '旅程から削除',
        trip: {
            title: '旅程 · {count}/{max}',
            optimize: 'ルートを最適化',
            optimizing: '最適化中…',
            clear: 'クリア',
            max: '最大{max}か所まで計画できます。',
            failed: 'ルートを最適化できませんでした。',
            summary: 'ホテル発着で往復{minutes}分',
        },
        directions: {
            open: 'ルートを検索',
            close: 'ルート検索を閉じる',
            whereFrom: '出発地は？',
            locateMe: '現在地を使用',
            locating: '現在地を取得中…',
            locationDenied: '現在地を取得できませんでした。出発地を入力してください。',
            searchFailed: '場所を検索できませんでした。もう一度お試しください。',
            toHotel: 'ホテルまで{minutes}分',
        },
        weather: { feelsLike: '体感 {temp}', highLow: '{high} / {low}' },
    },
    zh: {
        hotel: '酒店',
        categoryLabel: '地点类型',
        radiusLabel: '搜索范围',
        unitLabel: '距离单位',
        categories: { all: '全部', restaurant: '餐饮', cafe: '咖啡馆', attraction: '景点 & 公园', grocery: '杂货', medical: '医院 & 健康', transit: '交通' },
        loadFailed: '无法加载附近地点。',
        retry: '重试',
        details: '详情',
        close: '关闭',
        scrollLeft: '向左滚动',
        scrollRight: '向右滚动',
        away: '距离 {distance}',
        fromHotel: '距酒店 {distance}',
        reviewsCount: '{count, plural, other {# 条评价}}',
        call: '致电',
        website: '网站',
        googleMaps: 'Google 地图',
        drive: '驾车',
        walk: '步行',
        bike: '骑行',
        traffic: '实时路况',
        travelMode: '出行方式',
        minutes: '{count} 分钟',
        loadingRoute: '正在查找路线…',
        routeUnavailable: '无可用路线',
        addToTrip: '加入行程',
        removeFromTrip: '移出行程',
        trip: {
            title: '我的行程 · {count}/{max}',
            optimize: '优化路线',
            optimizing: '正在优化…',
            clear: '清空',
            max: '最多可规划 {max} 个地点。',
            failed: '无法优化此路线。',
            summary: '从酒店出发往返 {minutes} 分钟',
        },
        directions: {
            open: '获取路线',
            close: '收起路线',
            whereFrom: '从哪里出发？',
            locateMe: '使用我的位置',
            locating: '正在定位…',
            locationDenied: '无法获取您的位置，请输入出发地。',
            searchFailed: '无法搜索地点，请重试。',
            toHotel: '到酒店 {minutes} 分钟',
        },
        weather: { feelsLike: '体感 {temp}', highLow: '{high} / {low}' },
    },
};

/** Keys whose ko/ja/zh are v1's human translations (hotels.searchResults.discovery). */
const FROM_V1 = new Set([
    'categories.restaurant', 'categories.attraction', 'categories.grocery', 'categories.medical', 'categories.transit',
]);

function insertBlock(file, block) {
    const src = fs.readFileSync(file, 'utf8');
    const eol = src.includes('\r\n') ? '\r\n' : '\n';
    const step = /^\{\r?\n( +)"/.exec(src)?.[1];
    if (!step) throw new Error(`${file}: cannot read the indent step`);
    if (JSON.parse(src).property?.nearby) throw new Error(`${file}: property.nearby already exists`);
    const anchor = `${eol}${step}"property": {${eol}`;
    const at = src.indexOf(anchor);
    if (at < 0) throw new Error(`${file}: no top-level "property" key`);
    const childIndent = step + step;
    const body = JSON.stringify(block, null, step.length)
        .split('\n')
        .map((line, i) => (i === 0 ? line : childIndent + line))
        .join(eol);
    const insertAt = at + anchor.length;
    const next = `${src.slice(0, insertAt)}${childIndent}"nearby": ${body},${eol}${src.slice(insertAt)}`;
    JSON.parse(next);
    fs.writeFileSync(file, next);
}

for (const lang of Object.keys(MESSAGES)) insertBlock(`src/locales/${lang}.json`, MESSAGES[lang]);

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]);
const get = (o, path) => path.split('.').reduce((n, k) => n[k], o);
const rows = flat(MESSAGES.en)
    .filter(([key]) => !FROM_V1.has(key))
    .map(([key, en]) => `| \`property.nearby.${key}\` | ${en} | ${get(MESSAGES.ko, key)} | ${get(MESSAGES.ja, key)} | ${get(MESSAGES.zh, key)} |`);
const review = 'src/locales/NEEDS_NATIVE_REVIEW.md';
const reviewSrc = fs.readFileSync(review, 'utf8');
const reviewEol = reviewSrc.includes('\r\n') ? '\r\n' : '\n';
const section = [
    '',
    '## property.nearby',
    '',
    'The nearby-places explorer on the property page (spec 2026-10-08). The category names marked',
    'restaurant/attraction/grocery/medical/transit came from v1 and are not listed.',
    '',
    '| Key | English | 한국어 | 日本語 | 中文 |',
    '|-----|---------|--------|--------|------|',
    ...rows,
    '',
].join(reviewEol);
fs.writeFileSync(review, reviewSrc.replace(/\s*$/, '') + reviewEol + section);
console.log(`inserted property.nearby; ${rows.length} strings listed for review`);
```

- [ ] **Step 4: Run it and check the diff**

```bash
node scripts/add-nearby-messages.mjs
git diff --stat src/locales
```

Expected: `inserted property.nearby; 45 strings listed for review` (50 keys, 5 of them from v1); the stat shows only insertions (`+`) for the four JSON files and `NEEDS_NATIVE_REVIEW.md`, no deletions.

- [ ] **Step 5: Run the test, delete the script**

```bash
npx vitest run src/locales/__tests__
rm scripts/add-nearby-messages.mjs
```

Expected: PASS (nearby-keys and the existing checkout-keys).

- [ ] **Step 6: Commit**

```bash
git add src/locales/en.json src/locales/ko.json src/locales/ja.json src/locales/zh.json src/locales/NEEDS_NATIVE_REVIEW.md src/locales/__tests__/nearby-keys.test.ts
git commit -m "feat(i18n): property.nearby strings in en/ko/ja/zh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 9: Shared nearby types, links, opening-hours grouping, test fixtures

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/components/nearby/types.ts`
- Create: `src/features/hotels/components/nearby/links.ts`
- Create: `src/features/hotels/components/nearby/opening-hours.ts`
- Create: `src/features/hotels/__tests__/nearby-fixtures.tsx`
- Test: `src/features/hotels/__tests__/nearby-helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/features/hotels/__tests__/nearby-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupOpeningHours } from '@/features/hotels/components/nearby/opening-hours';
import { googleMapsUrl } from '@/features/hotels/components/nearby/links';

describe('groupOpeningHours', () => {
    it('joins consecutive days with the same hours and marks today', () => {
        expect(groupOpeningHours(['Monday: 9 AM – 5 PM', 'Tuesday: 9 AM – 5 PM', 'Wednesday: Closed'], 'Tuesday')).toEqual([
            { text: 'Monday - Tuesday: 9 AM – 5 PM', includesToday: true },
            { text: 'Wednesday: Closed', includesToday: false },
        ]);
    });

    it('keeps a line with no day as it is', () => {
        expect(groupOpeningHours(['Open 24 hours'], 'Monday')).toEqual([{ text: 'Open 24 hours', includesToday: false }]);
    });

    it('returns nothing for no hours', () => {
        expect(groupOpeningHours(undefined, 'Monday')).toEqual([]);
        expect(groupOpeningHours([], 'Monday')).toEqual([]);
    });
});

describe('googleMapsUrl', () => {
    it('names the place and pins Google’s id when there is one', () => {
        const url = new URL(googleMapsUrl({ name: 'Cafe Onion', placeId: 'g-1' }));
        expect(url.searchParams.get('query')).toBe('Cafe Onion');
        expect(url.searchParams.get('query_place_id')).toBe('g-1');
    });

    it('searches by name alone without one', () => {
        const url = new URL(googleMapsUrl({ name: 'Cafe Onion' }));
        expect(url.searchParams.has('query_place_id')).toBe(false);
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/nearby-helpers.test.ts`
Expected: FAIL — cannot resolve the modules.

- [ ] **Step 3: Implement**

`src/features/hotels/components/nearby/types.ts`:

```ts
/**
 * The colours the nearby explorer paints with — the property page's palette (ADR-0004), which it
 * passes down as is. Declared here structurally so the explorer does not import the page.
 */
export interface NearbyPalette {
    bg: string;
    title: string;
    text: string;
    muted: string;
    soft: string;
    hairline: string;
    cardBg: string;
    cardBorder: string;
    iconBg: string;
    mapStyle: string;
}

export interface LatLng {
    lat: number;
    lng: number;
}

/** Mapbox's Optimization API takes 12 coordinates; the hotel is one of them. */
export const MAX_TRIP_STOPS = 11;
```

`src/features/hotels/components/nearby/links.ts`:

```ts
/** A Google Maps search for the place, pinned to Google's own id when there is one. */
export function googleMapsUrl(place: { name: string; placeId?: string }): string {
    const qs = new URLSearchParams({ api: '1', query: place.name });
    if (place.placeId) qs.set('query_place_id', place.placeId);
    return `https://www.google.com/maps/search/?${qs.toString()}`;
}
```

`src/features/hotels/components/nearby/opening-hours.ts`:

```ts
export interface HoursGroup {
    text: string;
    includesToday: boolean;
}

/**
 * Google's seven "Day: hours" lines, with runs of identical hours folded together —
 * "Monday - Friday: 9 AM – 5 PM" rather than five lines saying the same thing.
 *
 * `today` is the English weekday name (Google's lines are English: the API is called with
 * language=en), passed in so this stays a pure function.
 */
export function groupOpeningHours(weekdayText: readonly string[] | undefined, today: string): HoursGroup[] {
    if (!weekdayText?.length) return [];

    const parsed = weekdayText.map((line) => {
        const match = line.match(/^(.+?):\s*(.+)$/);
        return match ? { day: match[1].trim(), hours: match[2].trim() } : { day: line.trim(), hours: '' };
    });

    const groups: { start: string; end: string; hours: string; days: string[] }[] = [];
    for (const { day, hours } of parsed) {
        const last = groups[groups.length - 1];
        if (last && hours !== '' && last.hours === hours) {
            last.end = day;
            last.days.push(day);
        } else {
            groups.push({ start: day, end: day, hours, days: [day] });
        }
    }

    return groups.map((g) => ({
        text: g.hours === '' ? g.start : `${g.start === g.end ? g.start : `${g.start} - ${g.end}`}: ${g.hours}`,
        includesToday: g.days.some((d) => d.toLowerCase() === today.toLowerCase()),
    }));
}
```

`src/features/hotels/__tests__/nearby-fixtures.tsx` (shared by the component tests below; not itself a test file):

```tsx
import React from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { Search } from 'lucide-react';
import enMessages from '@/locales/en.json';
import type { NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import type { NearbyPalette } from '@/features/hotels/components/nearby/types';

export const HOTEL = { lat: 37.55, lng: 126.98 };

/** 356 m due north of HOTEL: "360 m" in km, "0.2 mi" in miles. */
export const NEAR = { lat: 37.5532, lng: 126.98 };

export const PALETTE: NearbyPalette = {
    bg: '#ffffff', title: '#0f172a', text: '#334155', muted: '#64748b', soft: '#475569',
    hairline: '#e2e8f0', cardBg: 'rgba(0,0,0,.03)', cardBorder: 'rgba(0,0,0,.08)',
    iconBg: 'rgba(0,0,0,.04)', mapStyle: 'mapbox://styles/mapbox/streets-v12',
};

export function gem(overrides: Partial<NearbyGem> = {}): NearbyGem {
    return {
        id: 'g-1',
        placeId: 'g-1',
        name: 'Cafe Onion',
        category: 'cafe',
        rating: 4.6,
        imageUrl: 'http://api.test/api/v2/photos/poi?name=Cafe+Onion',
        icon: Search,
        coordinates: NEAR,
        isStub: false,
        ...overrides,
    };
}

export function renderWithIntl(ui: React.ReactElement) {
    return render(
        <NextIntlClientProvider locale="en" messages={enMessages as never}>{ui}</NextIntlClientProvider>,
    );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/hotels/__tests__/nearby-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/hotels/components/nearby/types.ts src/features/hotels/components/nearby/links.ts src/features/hotels/components/nearby/opening-hours.ts src/features/hotels/__tests__/nearby-fixtures.tsx src/features/hotels/__tests__/nearby-helpers.test.ts
git commit -m "feat(nearby): shared types, Google Maps link, opening-hours grouping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 10: `PlaceStrip`

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/components/nearby/PlaceStrip.tsx`
- Test: `src/features/hotels/__tests__/PlaceStrip.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/features/hotels/__tests__/PlaceStrip.test.tsx`:

```tsx
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { PoiCategory } from '@/shared/config/map-discovery';
import type { DistanceUnit } from '@/shared/lib/distance';
import { PlaceStrip } from '@/features/hotels/components/nearby/PlaceStrip';
import { HOTEL, PALETTE, gem, renderWithIntl } from './nearby-fixtures';

function props(overrides: Partial<React.ComponentProps<typeof PlaceStrip>> = {}) {
    return {
        gems: [gem()],
        loading: false,
        error: false,
        onRetry: vi.fn(),
        category: 'all' as PoiCategory,
        onCategoryChange: vi.fn(),
        radius: 2000,
        onRadiusChange: vi.fn(),
        unit: 'km' as DistanceUnit,
        onUnitChange: vi.fn(),
        hotel: HOTEL,
        activeId: null,
        onSelect: vi.fn(),
        onDetails: vi.fn(),
        palette: PALETTE,
        ...overrides,
    };
}

const radiusLabels = () =>
    screen.getAllByRole('radio').filter((r) => r.closest('[aria-label="Search radius"]')).map((r) => r.textContent);

describe('PlaceStrip', () => {
    it('shows each place with its distance in kilometres', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        expect(screen.getByText('Cafe Onion')).toBeInTheDocument();
        expect(screen.getByText('360 m')).toBeInTheDocument();
    });

    it('shows distances and radius steps in miles', () => {
        renderWithIntl(<PlaceStrip {...props({ unit: 'mi', radius: 1609 })} />);
        expect(screen.getByText('0.2 mi')).toBeInTheDocument();
        expect(radiusLabels()).toEqual(['0.5 mi', '1 mi', '3 mi', '5 mi']);
    });

    it('offers round radius steps in kilometres and marks the current one', () => {
        renderWithIntl(<PlaceStrip {...props()} />);
        expect(radiusLabels()).toEqual(['1 km', '2 km', '5 km', '10 km']);
        expect(screen.getByRole('radio', { name: '2 km' })).toHaveAttribute('aria-checked', 'true');
    });

    it('reports a radius pick in metres', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);
        fireEvent.click(screen.getByRole('radio', { name: '5 km' }));
        expect(p.onRadiusChange).toHaveBeenCalledWith(5000);
    });

    it('reports a unit switch', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);
        fireEvent.click(screen.getByRole('radio', { name: 'mi' }));
        expect(p.onUnitChange).toHaveBeenCalledWith('mi');
    });

    it('picks a category from the dropdown', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);
        fireEvent.click(screen.getByRole('button', { name: 'Place type' }));
        fireEvent.click(screen.getByRole('option', { name: 'Dining' }));
        expect(p.onCategoryChange).toHaveBeenCalledWith('restaurant');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('selects a place, or opens its details, from its card', () => {
        const p = props();
        renderWithIntl(<PlaceStrip {...p} />);

        fireEvent.click(screen.getByRole('button', { name: 'Cafe Onion' }));
        expect(p.onSelect).toHaveBeenCalledWith(p.gems[0]);

        fireEvent.click(screen.getByRole('button', { name: 'Details' }));
        expect(p.onDetails).toHaveBeenCalledWith(p.gems[0]);
        expect(p.onSelect).toHaveBeenCalledTimes(1);
    });

    it('shows placeholders while loading', () => {
        renderWithIntl(<PlaceStrip {...props({ gems: [], loading: true })} />);
        expect(screen.getAllByTestId('place-skeleton')).toHaveLength(8);
    });

    it('says the lookup failed — not that nothing is nearby — and offers a retry', () => {
        const p = props({ gems: [], error: true });
        renderWithIntl(<PlaceStrip {...p} />);

        expect(screen.getByText("Couldn't load nearby places.")).toBeInTheDocument();
        expect(screen.queryByText('No places found nearby.')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(p.onRetry).toHaveBeenCalled();
    });

    it('says when there is genuinely nothing nearby', () => {
        renderWithIntl(<PlaceStrip {...props({ gems: [] })} />);
        expect(screen.getByText('No places found nearby.')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/PlaceStrip.test.tsx`
Expected: FAIL — cannot resolve `PlaceStrip`.

- [ ] **Step 3: Implement**

`src/features/hotels/components/nearby/PlaceStrip.tsx`:

```tsx
'use client';

import React, { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { POI_FILTERS, type PoiCategory } from '@/shared/config/map-discovery';
import { categoryToBg, type NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import { DistanceUnitToggle } from '@/shared/components/common/DistanceUnitToggle';
import { RADIUS_OPTIONS, formatDistance, haversineMeters, type DistanceUnit } from '@/shared/lib/distance';
import { BRAND } from '@/shared/lib/palette';
import type { LatLng, NearbyPalette } from './types';

interface PlaceStripProps {
    gems: NearbyGem[];
    loading: boolean;
    error: boolean;
    onRetry: () => void;
    category: PoiCategory;
    onCategoryChange: (category: PoiCategory) => void;
    /** Metres. */
    radius: number;
    onRadiusChange: (meters: number) => void;
    unit: DistanceUnit;
    onUnitChange: (unit: DistanceUnit) => void;
    hotel: LatLng;
    activeId: string | null;
    onSelect: (gem: NearbyGem) => void;
    onDetails: (gem: NearbyGem) => void;
    palette: NearbyPalette;
}

const SKELETONS = 8;

export function PlaceStrip({
    gems, loading, error, onRetry, category, onCategoryChange, radius, onRadiusChange,
    unit, onUnitChange, hotel, activeId, onSelect, onDetails, palette,
}: PlaceStripProps) {
    const t = useTranslations('property.nearby');
    const tAll = useTranslations();
    const locale = useLocale();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [menuOpen, setMenuOpen] = useState(false);

    const selected = POI_FILTERS.find((f) => f.id === category) ?? POI_FILTERS[0];
    const SelectedIcon = selected.icon;
    const scroll = (direction: -1 | 1) => scrollRef.current?.scrollBy({ left: direction * 300, behavior: 'smooth' });

    const pill: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
        border: `1px solid ${palette.cardBorder}`, background: palette.cardBg, color: palette.title,
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
    };

    let body: React.ReactNode;
    if (gems.length > 0) {
        body = gems.map((g) => (
            <PlaceCard
                key={g.id}
                gem={g}
                distance={formatDistance(haversineMeters(hotel, g.coordinates), unit, locale)}
                active={g.id === activeId}
                onSelect={onSelect}
                onDetails={onDetails}
                detailsLabel={t('details')}
            />
        ));
    } else if (loading) {
        body = Array.from({ length: SKELETONS }, (_, i) => (
            <div key={i} data-testid="place-skeleton" className="shrink-0 animate-pulse rounded-2xl" style={{ width: 192, height: 128, background: palette.iconBg }} />
        ));
    } else if (error) {
        body = (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, color: palette.muted, fontSize: 15, padding: '16px 0' }}>
                <span>{t('loadFailed')}</span>
                <button type="button" onClick={onRetry} style={pill}>{t('retry')}</button>
            </div>
        );
    } else {
        body = <p style={{ color: palette.muted, fontSize: 15, padding: '16px 0' }}>{tAll('hotels.nearby.none')}</p>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                    <button
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={menuOpen}
                        aria-label={t('categoryLabel')}
                        onClick={() => setMenuOpen((open) => !open)}
                        style={pill}
                    >
                        <SelectedIcon size={14} aria-hidden />
                        <span>{t(`categories.${selected.id}`)}</span>
                        <ChevronDown size={14} aria-hidden style={{ transform: menuOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
                    </button>
                    {menuOpen && (
                        <>
                            <div aria-hidden onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                            <div
                                role="listbox"
                                aria-label={t('categoryLabel')}
                                style={{
                                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, minWidth: 200,
                                    padding: 6, borderRadius: 14, background: palette.bg,
                                    border: `1px solid ${palette.cardBorder}`, boxShadow: '0 12px 32px rgba(0,0,0,.25)',
                                }}
                            >
                                {POI_FILTERS.map((f) => {
                                    const Icon = f.icon;
                                    const active = f.id === category;
                                    return (
                                        <button
                                            key={f.id}
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            onClick={() => { onCategoryChange(f.id); setMenuOpen(false); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
                                                borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                                                fontSize: 14, fontWeight: 600,
                                                background: active ? BRAND.primaryStrong : 'transparent',
                                                color: active ? '#fff' : palette.text,
                                            }}
                                        >
                                            <Icon size={14} aria-hidden />
                                            {t(`categories.${f.id}`)}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                <div role="radiogroup" aria-label={t('radiusLabel')} style={{ ...pill, gap: 2, padding: 2, cursor: 'default' }}>
                    {RADIUS_OPTIONS[unit].map((meters) => {
                        const active = meters === radius;
                        return (
                            <button
                                key={meters}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => onRadiusChange(meters)}
                                style={{
                                    padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                                    fontSize: 13, fontWeight: 700,
                                    background: active ? BRAND.primaryStrong : 'transparent',
                                    color: active ? '#fff' : palette.muted,
                                }}
                            >
                                {formatDistance(meters, unit, locale)}
                            </button>
                        );
                    })}
                </div>

                <DistanceUnitToggle
                    value={unit}
                    onChange={onUnitChange}
                    label={t('unitLabel')}
                    colors={{ muted: palette.muted, border: palette.cardBorder, activeBg: BRAND.primaryStrong, activeFg: '#fff' }}
                />
            </div>

            <div style={{ position: 'relative' }}>
                {gems.length > 3 && (
                    <button type="button" aria-label={t('scrollLeft')} onClick={() => scroll(-1)} className="hidden lg:flex" style={arrowStyle('left', palette)}>
                        <ChevronLeft size={16} aria-hidden />
                    </button>
                )}
                <div ref={scrollRef} className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollBehavior: 'smooth', padding: '4px 2px' }}>
                    {body}
                </div>
                {gems.length > 3 && (
                    <button type="button" aria-label={t('scrollRight')} onClick={() => scroll(1)} className="hidden lg:flex" style={arrowStyle('right', palette)}>
                        <ChevronRight size={16} aria-hidden />
                    </button>
                )}
            </div>
        </div>
    );
}

function arrowStyle(side: 'left' | 'right', palette: NearbyPalette): React.CSSProperties {
    return {
        ...(side === 'left' ? { left: -12 } : { right: -12 }),
        position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 10,
        width: 30, height: 30, borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
        background: palette.bg, color: palette.title, border: `1px solid ${palette.cardBorder}`,
        boxShadow: '0 4px 12px rgba(0,0,0,.2)', cursor: 'pointer',
    };
}

interface PlaceCardProps {
    gem: NearbyGem;
    distance: string;
    active: boolean;
    onSelect: (gem: NearbyGem) => void;
    onDetails: (gem: NearbyGem) => void;
    detailsLabel: string;
}

/**
 * A photo card. The whole card selects the place; "Details" sits above it as a separate button, so
 * the two are siblings rather than a button inside a button.
 */
function PlaceCard({ gem, distance, active, onSelect, onDetails, detailsLabel }: PlaceCardProps) {
    const Icon = gem.icon;
    const rating = gem.rating !== null && gem.rating > 0 ? gem.rating.toFixed(1) : null;
    const name = gem.translatedName ?? gem.name;

    return (
        <div
            className={`relative shrink-0 overflow-hidden rounded-2xl bg-linear-to-br ${categoryToBg(gem.category)}`}
            style={{ width: 192, height: 128, outline: active ? `3px solid ${BRAND.primary}` : 'none', outlineOffset: 2 }}
        >
            <img
                src={gem.imageUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Icon size={34} className="text-white/20" aria-hidden />
            </div>

            <button
                type="button"
                aria-label={gem.name}
                aria-pressed={active}
                onClick={() => onSelect(gem)}
                className="absolute inset-0 cursor-pointer"
                style={{ background: 'transparent', border: 'none' }}
            />

            {rating && (
                <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[11px] font-extrabold text-slate-800">
                    <Star size={10} className="fill-amber-400 text-amber-400" aria-hidden />
                    {rating}
                </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-2.5">
                <div className="truncate text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {gem.displayCategory ?? gem.category.replace(/_/g, ' ')}
                </div>
                <div className="line-clamp-2 text-[13px] font-extrabold leading-tight text-white" aria-hidden={name === gem.name}>
                    {name}
                </div>
                <div className="text-[11px] font-semibold text-white/75">{distance}</div>
            </div>

            <button
                type="button"
                onClick={() => onDetails(gem)}
                className="absolute top-2 right-2 z-10 rounded-lg bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur hover:bg-black/55"
            >
                {detailsLabel}
            </button>
        </div>
    );
}
```

Note on the test `screen.getByText('Cafe Onion')`: the card's visible name renders as text; the select button carries the same name as its accessible label. `aria-hidden` on the visible name (when identical) keeps screen readers from reading it twice — `getByText` still finds it because Testing Library's `getByText` does not filter on `aria-hidden`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/hotels/__tests__/PlaceStrip.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/hotels/components/nearby/PlaceStrip.tsx src/features/hotels/__tests__/PlaceStrip.test.tsx
git commit -m "feat(nearby): place strip with category, radius and unit controls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 11: `PlaceDetailsModal`

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/components/nearby/PlaceDetailsModal.tsx`
- Test: `src/features/hotels/__tests__/PlaceDetailsModal.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/features/hotels/__tests__/PlaceDetailsModal.test.tsx`:

```tsx
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlaceDetailsModal } from '@/features/hotels/components/nearby/PlaceDetailsModal';
import { HOTEL, PALETTE, gem, renderWithIntl } from './nearby-fixtures';

const RICH = gem({
    userRatingsTotal: 1200,
    vicinity: '8 Achasan-ro',
    phone: '02-1234-5678',
    website: 'https://onion.example',
    openingHours: { open_now: true, weekday_text: ['Monday: 9 AM – 5 PM', 'Tuesday: 9 AM – 5 PM'] },
    reviews: [{ author_name: 'Min', rating: 5, text: 'Great bread', relative_time_description: 'a week ago' }],
});

function open(g = RICH, onClose = vi.fn()) {
    renderWithIntl(<PlaceDetailsModal gem={g} hotel={HOTEL} unit="km" palette={PALETTE} onClose={onClose} />);
    return onClose;
}

describe('PlaceDetailsModal', () => {
    it('renders nothing without a place', () => {
        renderWithIntl(<PlaceDetailsModal gem={null} hotel={HOTEL} unit="km" palette={PALETTE} onClose={vi.fn()} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the place, its rating, distance and contact links', () => {
        open();
        const dialog = screen.getByRole('dialog', { name: 'Cafe Onion' });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText('1,200 reviews')).toBeInTheDocument();
        expect(screen.getByText(/360 m away/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:02-1234-5678');
        expect(screen.getByRole('link', { name: /Website/ })).toHaveAttribute('href', 'https://onion.example');
        expect(screen.getByRole('link', { name: /Google Maps/ }).getAttribute('href')).toContain('query_place_id=g-1');
    });

    it('groups the opening hours and says whether it is open', () => {
        open();
        expect(screen.getByText('Opening Hours')).toBeInTheDocument();
        expect(screen.getByText('Open Now')).toBeInTheDocument();
        expect(screen.getByText('Monday - Tuesday: 9 AM – 5 PM')).toBeInTheDocument();
    });

    it('shows Google reviews and no form to write one', () => {
        open();
        expect(screen.getByText('Google Reviews')).toBeInTheDocument();
        expect(screen.getByText('Great bread')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('hides what it does not have', () => {
        open(gem());
        expect(screen.queryByRole('link', { name: /Call/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Website/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Opening Hours')).not.toBeInTheDocument();
        expect(screen.getByText('No direct reviews available for this place yet.')).toBeInTheDocument();
    });

    it('closes on Escape and on its close button', () => {
        const onClose = open();
        fireEvent.keyDown(window, { key: 'Escape' });
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/PlaceDetailsModal.test.tsx`
Expected: FAIL — cannot resolve `PlaceDetailsModal`.

- [ ] **Step 3: Implement**

`src/features/hotels/components/nearby/PlaceDetailsModal.tsx`:

```tsx
'use client';

import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Clock, Globe, MapPin, Phone, Star, X } from 'lucide-react';
import { categoryToBg, type NearbyGem, type PoiReview } from '@/features/hotels/hooks/useNearbyGems';
import { formatDistance, haversineMeters, type DistanceUnit } from '@/shared/lib/distance';
import { BRAND } from '@/shared/lib/palette';
import { googleMapsUrl } from './links';
import { groupOpeningHours } from './opening-hours';
import type { LatLng, NearbyPalette } from './types';

interface PlaceDetailsModalProps {
    gem: NearbyGem | null;
    hotel: LatLng;
    unit: DistanceUnit;
    palette: NearbyPalette;
    onClose: () => void;
}

/**
 * v1's place popup — photo, rating, call / website / map, hours, Google's reviews.
 *
 * v1 also had a form to post a review and photos. It saved to the poster's own browser and showed
 * the result as "Cheapest Go Reviews" though nobody else could ever see it, so it is not ported.
 */
export function PlaceDetailsModal({ gem, hotel, unit, palette, onClose }: PlaceDetailsModalProps) {
    const t = useTranslations('property.nearby');
    const tPoi = useTranslations('property.poiDetails');
    const locale = useLocale();
    const titleId = useId();

    useEffect(() => {
        if (!gem) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [gem, onClose]);

    if (!gem) return null;

    const name = gem.translatedName ?? gem.name;
    const distance = formatDistance(haversineMeters(hotel, gem.coordinates), unit, locale);
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const hours = groupOpeningHours(gem.openingHours?.weekday_text, today);
    const reviews = gem.reviews ?? [];
    const Icon = gem.icon;

    const action: React.CSSProperties = {
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px',
        borderRadius: 12, background: palette.iconBg, color: palette.title, fontSize: 14, fontWeight: 700,
        textDecoration: 'none', border: `1px solid ${palette.cardBorder}`,
    };

    return createPortal(
        <div
            role="presentation"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', borderRadius: 20, background: palette.bg, color: palette.text, border: `1px solid ${palette.cardBorder}`, boxShadow: '0 24px 60px rgba(0,0,0,.4)' }}
            >
                <div className={`relative bg-linear-to-br ${categoryToBg(gem.category)}`} style={{ height: 200 }}>
                    <img src={gem.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><Icon size={48} className="text-white/20" aria-hidden /></div>
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                    <button
                        type="button"
                        aria-label={t('close')}
                        onClick={onClose}
                        style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.45)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                        <X size={18} aria-hidden />
                    </button>
                    <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16, color: '#fff' }}>
                        <h2 id={titleId} style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, margin: 0 }}>{name}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 14, flexWrap: 'wrap' }}>
                            {gem.rating !== null && gem.rating > 0 && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                                    <Star size={14} fill="#f59e0b" color="#f59e0b" aria-hidden /> {gem.rating.toFixed(1)}
                                </span>
                            )}
                            {gem.userRatingsTotal ? <span style={{ opacity: 0.8 }}>{t('reviewsCount', { count: gem.userRatingsTotal })}</span> : null}
                            <span style={{ opacity: 0.8 }}>· {t('away', { distance })}</span>
                        </div>
                    </div>
                </div>

                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {gem.phone && <a href={`tel:${gem.phone}`} style={action}><Phone size={16} aria-hidden />{t('call')}</a>}
                        {gem.website && <a href={gem.website} target="_blank" rel="noopener noreferrer" style={action}><Globe size={16} aria-hidden />{t('website')}</a>}
                        <a href={googleMapsUrl(gem)} target="_blank" rel="noopener noreferrer" style={action}><MapPin size={16} aria-hidden />{t('googleMaps')}</a>
                    </div>

                    {gem.vicinity && (
                        <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: 0, color: palette.soft, fontSize: 15 }}>
                            <MapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />{gem.vicinity}
                        </p>
                    )}

                    {hours.length > 0 && (
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Clock size={16} color={palette.muted} aria-hidden />
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: palette.title }}>{tPoi('openingHours')}</h3>
                                {gem.openingHours?.open_now !== undefined && (
                                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, background: gem.openingHours.open_now ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', color: gem.openingHours.open_now ? '#059669' : '#dc2626' }}>
                                        {gem.openingHours.open_now ? tPoi('openNow') : tPoi('closed')}
                                    </span>
                                )}
                            </div>
                            {hours.map((h) => (
                                <p key={h.text} style={{ margin: '2px 0', fontSize: 14, color: h.includesToday ? palette.title : palette.muted, fontWeight: h.includesToday ? 700 : 400 }}>{h.text}</p>
                            ))}
                        </section>
                    )}

                    <section>
                        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: palette.title }}>{tPoi('googleReviews')}</h3>
                        {reviews.length === 0
                            ? <p style={{ margin: 0, fontSize: 14, color: palette.muted }}>{tPoi('noReviews')}</p>
                            : reviews.map((r, i) => <ReviewItem key={`${r.author_name}-${i}`} review={r} palette={palette} />)}
                    </section>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function ReviewItem({ review, palette }: { review: PoiReview; palette: NearbyPalette }) {
    return (
        <div style={{ padding: 14, borderRadius: 14, background: palette.cardBg, border: `1px solid ${palette.cardBorder}`, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {review.profile_photo_url
                    ? <img src={review.profile_photo_url} alt="" width={28} height={28} referrerPolicy="no-referrer" style={{ borderRadius: '50%' }} />
                    : <div style={{ width: 28, height: 28, borderRadius: '50%', background: BRAND.primaryStrong, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{review.author_name.charAt(0)}</div>}
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: palette.title }}>{review.author_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: palette.muted }}>
                        <span aria-label={`${review.rating} / 5`}>{'★'.repeat(Math.round(review.rating))}</span>
                        {review.relative_time_description && <span>{review.relative_time_description}</span>}
                    </div>
                </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: palette.text }}>{review.text}</p>
        </div>
    );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/hotels/__tests__/PlaceDetailsModal.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/hotels/components/nearby/PlaceDetailsModal.tsx src/features/hotels/__tests__/PlaceDetailsModal.test.tsx
git commit -m "feat(nearby): place details popup — hours, contact, Google reviews

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 12: `NearbyMap` + `NearbyExplorer`, mounted on the property page

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/components/nearby/NearbyMap.tsx`
- Create: `src/features/hotels/components/nearby/NearbyExplorer.tsx`
- Modify: `src/features/hotels/components/property-view.tsx`
- Test: `src/features/hotels/__tests__/NearbyExplorer.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/features/hotels/__tests__/NearbyExplorer.test.tsx`:

```tsx
import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NearbyGem } from '@/features/hotels/hooks/useNearbyGems';

const nearby = vi.hoisted(() => ({
    value: { gems: [] as NearbyGem[], loading: false, error: false, retry: () => {} },
}));

vi.mock('@/features/hotels/components/nearby/NearbyMap', () => ({
    NearbyMap: ({ children, places, onSelect }: { children?: React.ReactNode; places: NearbyGem[]; onSelect: (g: NearbyGem) => void }) => (
        <div data-testid="map">
            {places.map((p) => <button key={p.id} type="button" onClick={() => onSelect(p)}>pin {p.name}</button>)}
            {children}
        </div>
    ),
}));
vi.mock('@/features/hotels/hooks/useNearbyGems', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/features/hotels/hooks/useNearbyGems')>()),
    useNearbyGems: vi.fn(() => nearby.value),
}));

import { NearbyExplorer } from '@/features/hotels/components/nearby/NearbyExplorer';
import { useNearbyGems } from '@/features/hotels/hooks/useNearbyGems';
import { useSearchStore } from '@/shared/stores/search.store';
import { HOTEL, PALETTE, gem, renderWithIntl } from './nearby-fixtures';

beforeEach(() => {
    localStorage.clear();
    useSearchStore.setState({ distanceUnit: 'km' });
    nearby.value = { gems: [gem()], loading: false, error: false, retry: () => {} };
    vi.mocked(useNearbyGems).mockClear();
});

const explorer = () => renderWithIntl(<NearbyExplorer coordinates={HOTEL} hotelName="Hotel Onion" palette={PALETTE} />);

describe('NearbyExplorer', () => {
    it('opens a place’s details from its card', () => {
        explorer();
        fireEvent.click(screen.getByRole('button', { name: 'Details' }));
        expect(screen.getByRole('dialog', { name: 'Cafe Onion' })).toBeInTheDocument();
    });

    it('switching to miles re-snaps the radius and remembers the choice', () => {
        explorer();
        expect(useNearbyGems).toHaveBeenLastCalledWith(expect.objectContaining({ radiusMeters: 2000 }));

        fireEvent.click(screen.getByRole('radio', { name: 'mi' }));

        expect(useNearbyGems).toHaveBeenLastCalledWith(expect.objectContaining({ radiusMeters: 1609 }));
        expect(useSearchStore.getState().distanceUnit).toBe('mi');
    });

    it('changing category clears the selected place', () => {
        explorer();
        fireEvent.click(screen.getByRole('button', { name: 'Cafe Onion' }));
        expect(screen.getByRole('button', { name: 'Cafe Onion' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Place type' }));
        fireEvent.click(screen.getByRole('option', { name: 'Transit' }));

        expect(screen.getByRole('button', { name: 'Cafe Onion' })).toHaveAttribute('aria-pressed', 'false');
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/NearbyExplorer.test.tsx`
Expected: FAIL — cannot resolve `NearbyExplorer`.

- [ ] **Step 3: Implement `NearbyMap`**

`src/features/hotels/components/nearby/NearbyMap.tsx`:

```tsx
'use client';

import React, { useCallback, useMemo } from 'react';
import { Layer, Marker, Source, type MapRef } from 'react-map-gl/mapbox';
import { Map as MapView, type StandardStyleConfig } from '@/shared/components/ui/map';
import { NearbyPlaceMarker } from '@/shared/components/map/NearbyPlaceMarker';
import type { NearbyPlace } from '@/shared/components/map/useMapNearbyPlaces';
import type { NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import { BRAND, BRAND_STOPS } from '@/shared/lib/palette';
import type { LatLng } from './types';

export interface NearbyMapProps {
    mapRef: React.RefObject<MapRef | null>;
    hotel: LatLng;
    hotelLabel: string;
    places: NearbyGem[];
    activeId: string | null;
    onSelect: (gem: NearbyGem) => void;
    mapStyle: string;
    standardConfig?: StandardStyleConfig;
    route: GeoJSON.LineString | null;
    /** Where a "directions to the hotel" route starts. */
    origin?: (LatLng & { name: string }) | null;
    height: number | string;
    /** Drawn over the map: the callout, the controls, the weather. */
    children?: React.ReactNode;
}

function toPlace(gem: NearbyGem): NearbyPlace {
    return {
        name: gem.name,
        category: gem.category || 'place',
        lat: gem.coordinates.lat,
        lng: gem.coordinates.lng,
        rating: gem.rating ?? undefined,
        placeId: gem.id,
    };
}

export function NearbyMap({
    mapRef, hotel, hotelLabel, places, activeId, onSelect, mapStyle, standardConfig, route, origin, height, children,
}: NearbyMapProps) {
    const byId = useMemo(() => new globalThis.Map(places.map((g) => [g.id, g])), [places]);
    const handleMarker = useCallback((place: NearbyPlace) => {
        const gem = place.placeId ? byId.get(place.placeId) : undefined;
        if (gem) onSelect(gem);
    }, [byId, onSelect]);

    const routeData = useMemo(
        () => (route ? { type: 'Feature' as const, properties: {}, geometry: route } : null),
        [route],
    );

    return (
        <div style={{ position: 'relative', width: '100%', height, borderRadius: 12, overflow: 'hidden', background: '#1e293b' }}>
            <MapView
                ref={mapRef}
                mapStyle={mapStyle}
                standardConfig={standardConfig}
                initialViewState={{ longitude: hotel.lng, latitude: hotel.lat, zoom: 14 }}
                scrollZoom={false}
                className="h-full w-full"
            >
                {routeData && (
                    <Source id="nearby-route" type="geojson" data={routeData}>
                        <Layer
                            id="nearby-route-line"
                            type="line"
                            layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                            paint={{ 'line-color': BRAND_STOPS.from, 'line-width': 5, 'line-opacity': 0.85 }}
                        />
                    </Source>
                )}
                <Marker longitude={hotel.lng} latitude={hotel.lat} anchor="center" style={{ zIndex: 30 }}>
                    <div role="img" aria-label={hotelLabel} style={{ width: 18, height: 18, borderRadius: '50%', background: BRAND.gradient, border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.55)' }} />
                </Marker>
                {origin && (
                    <Marker longitude={origin.lng} latitude={origin.lat} anchor="center" style={{ zIndex: 30 }}>
                        <div role="img" aria-label={origin.name} style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', border: `4px solid ${BRAND_STOPS.from}`, boxShadow: '0 2px 6px rgba(0,0,0,.4)' }} />
                    </Marker>
                )}
                {places.map((gem, i) => (
                    <NearbyPlaceMarker key={gem.id} place={toPlace(gem)} isSelected={gem.id === activeId} onClick={handleMarker} index={i} />
                ))}
            </MapView>
            {children}
        </div>
    );
}
```

`StandardStyleConfig` is exported from `@/shared/components/ui/map`; `BRAND.gradient` is the hotel pin's fill on the property page today.

- [ ] **Step 4: Implement `NearbyExplorer` (slice 2 version)**

`src/features/hotels/components/nearby/NearbyExplorer.tsx`:

```tsx
'use client';

/**
 * Nearby places on the property page — v1's property map, rebuilt
 * (docs/superpowers/specs/2026-10-08-nearby-places-v1-parity-design.md).
 *
 * Owns the section's state and hands each piece only the slice it draws.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MapRef } from 'react-map-gl/mapbox';
import type { PoiCategory } from '@/shared/config/map-discovery';
import { useNearbyGems, type NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import { useDistanceUnit } from '@/shared/hooks/useDistanceUnit';
import { nearestRadius } from '@/shared/lib/distance';
import { NearbyMap } from './NearbyMap';
import { PlaceStrip } from './PlaceStrip';
import { PlaceDetailsModal } from './PlaceDetailsModal';
import type { LatLng, NearbyPalette } from './types';

interface NearbyExplorerProps {
    coordinates: LatLng;
    hotelName: string;
    palette: NearbyPalette;
}

const MAP_HEIGHT = 420;

export function NearbyExplorer({ coordinates, hotelName, palette }: NearbyExplorerProps) {
    const t = useTranslations('property.nearby');
    const mapRef = useRef<MapRef>(null);
    const [unit, setUnit] = useDistanceUnit();
    const [category, setCategory] = useState<PoiCategory>('all');
    const [radius, setRadius] = useState(2000);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [detailsId, setDetailsId] = useState<string | null>(null);

    // The radius picker offers round steps in the viewer's unit; keep the selection on one of
    // them when the unit flips (or when the browser's guess lands after hydration).
    useEffect(() => { setRadius((r) => nearestRadius(r, unit)); }, [unit]);

    const { gems, loading, error, retry } = useNearbyGems({ coordinates, category, radiusMeters: radius });
    const active = gems.find((g) => g.id === activeId) ?? null;
    const detailsGem = gems.find((g) => g.id === detailsId) ?? null;

    const select = useCallback((gem: NearbyGem) => {
        if (gem.id === activeId) {
            setActiveId(null);
            return;
        }
        setActiveId(gem.id);
        mapRef.current?.flyTo({ center: [gem.coordinates.lng, gem.coordinates.lat], zoom: 16, duration: 800 });
    }, [activeId]);

    const changeCategory = useCallback((next: PoiCategory) => {
        setCategory(next);
        setActiveId(null);
    }, []);

    const showDetails = useCallback((gem: NearbyGem) => setDetailsId(gem.id), []);
    const closeDetails = useCallback(() => setDetailsId(null), []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <NearbyMap
                mapRef={mapRef}
                hotel={coordinates}
                hotelLabel={hotelName || t('hotel')}
                places={gems}
                activeId={active?.id ?? null}
                onSelect={select}
                mapStyle={palette.mapStyle}
                route={null}
                height={MAP_HEIGHT}
            />
            <PlaceStrip
                gems={gems}
                loading={loading}
                error={error}
                onRetry={retry}
                category={category}
                onCategoryChange={changeCategory}
                radius={radius}
                onRadiusChange={setRadius}
                unit={unit}
                onUnitChange={setUnit}
                hotel={coordinates}
                activeId={active?.id ?? null}
                onSelect={select}
                onDetails={showDetails}
                palette={palette}
            />
            <PlaceDetailsModal gem={detailsGem} hotel={coordinates} unit={unit} palette={palette} onClose={closeDetails} />
        </div>
    );
}
```

- [ ] **Step 5: Run the explorer tests**

Run: `npx vitest run src/features/hotels/__tests__/NearbyExplorer.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Mount it on the property page**

In `src/features/hotels/components/property-view.tsx`:

1. Delete these three import lines:

```ts
import { Marker } from 'react-map-gl/mapbox';
```
```ts
import { Map } from '@/shared/components/ui/map';
import { useNearbyGems } from '@/features/hotels/hooks/useNearbyGems';
```

and add in their place:

```ts
import { NearbyExplorer } from '@/features/hotels/components/nearby/NearbyExplorer';
```

2. Delete everything from the line `// ─── Haversine distance (miles) ───…` down to, but not including, the line `// ─── PropertyContent ───…` (the `haversine`, `categoryDotColor` and `NearbySection` functions — about lines 205–303):

```bash
node -e "const fs=require('fs');const f='src/features/hotels/components/property-view.tsx';const s=fs.readFileSync(f,'utf8');const a=s.indexOf('// ─── Haversine distance (miles)');const b=s.indexOf('// ─── PropertyContent');if(a<0||b<0||b<a)throw new Error('markers not found');fs.writeFileSync(f,s.slice(0,a)+s.slice(b));"
```

3. Replace:

```tsx
                            <NearbySection coordinates={coordinates} palette={palette} />
```

with:

```tsx
                            <NearbyExplorer coordinates={coordinates} hotelName={content?.name ?? ''} palette={palette} />
```

- [ ] **Step 7: Type-check, lint, full suite**

```bash
npm run type-check
npm run lint
npx vitest run
```

Expected: no errors; all tests pass. If lint reports an unused import in `property-view.tsx` (for example `BRAND` or `ACCENT` only used by the removed section), remove that import — check with `grep -n "ACCENT\|BRAND\." src/features/hotels/components/property-view.tsx` that it is truly unused first (`ACCENT` is still used by the booking buttons, so it stays).

- [ ] **Step 8: Commit**

```bash
git add src/features/hotels/components/nearby/NearbyMap.tsx src/features/hotels/components/nearby/NearbyExplorer.tsx src/features/hotels/components/property-view.tsx src/features/hotels/__tests__/NearbyExplorer.test.tsx
git commit -m "feat(nearby): interactive nearby explorer replaces the static section

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 13: Search-map popups follow the unit

**Repo:** app-v2
**Files:**
- Modify: `src/shared/components/map/NearbyPlacePopup.tsx`
- Modify: `src/shared/components/mapbox/SearchMapContainer.tsx` (line 8 import; ~line 661 `poiDistance`; line 1020 `distance=`)
- Test: `src/shared/components/map/__tests__/NearbyPlacePopup.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/shared/components/map/__tests__/NearbyPlacePopup.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import enMessages from '@/locales/en.json';

vi.mock('react-map-gl/mapbox', () => ({
    Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Marker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { NearbyPlacePopup } from '@/shared/components/map/NearbyPlacePopup';
import { useSearchStore } from '@/shared/stores/search.store';

const PLACE = { name: 'Cafe Onion', category: 'cafe', lat: 37.55, lng: 126.98 };

const show = (distanceKm: number) => render(
    <NextIntlClientProvider locale="en" messages={enMessages as never}>
        <NearbyPlacePopup place={PLACE} distanceKm={distanceKm} onClose={vi.fn()} />
    </NextIntlClientProvider>,
);

beforeEach(() => localStorage.clear());

describe('NearbyPlacePopup distance', () => {
    it('reads in kilometres for a km viewer', () => {
        useSearchStore.setState({ distanceUnit: 'km' });
        show(1.234);
        expect(screen.getByText('1.2 km from the hotel')).toBeInTheDocument();
    });

    it('reads in metres under a kilometre', () => {
        useSearchStore.setState({ distanceUnit: 'km' });
        show(0.35);
        expect(screen.getByText('350 m from the hotel')).toBeInTheDocument();
    });

    it('reads in miles for a miles viewer', () => {
        useSearchStore.setState({ distanceUnit: 'mi' });
        show(1.234);
        expect(screen.getByText('0.8 mi from the hotel')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/shared/components/map/__tests__/NearbyPlacePopup.test.tsx`
Expected: FAIL — the popup prints `1.2km from the hotel` and ignores the unit.

- [ ] **Step 3: Update `NearbyPlacePopup`**

Add imports after `import { getCategoryIcon } from './NearbyPlaceMarker';`:

```ts
import { useLocale, useTranslations } from 'next-intl';
import { useDistanceUnit } from '@/shared/hooks/useDistanceUnit';
import { formatDistance } from '@/shared/lib/distance';
```

Delete the local helper:

```ts
function formatDistance(km: number): string {
    return km < 1
        ? `${Math.round(km * 1000)}m from the hotel`
        : `${km.toFixed(1)}km from the hotel`;
}
```

At the top of the component body (directly after `}: NearbyPlacePopupProps) {`), add:

```ts
    const t = useTranslations('property.nearby');
    const locale = useLocale();
    const [unit] = useDistanceUnit();
```

Replace:

```ts
            text: formatDistance(distanceKm),
```

with:

```ts
            text: t('fromHotel', { distance: formatDistance(distanceKm * 1000, unit, locale) }),
```

- [ ] **Step 4: Update `SearchMapContainer`**

Replace line 8:

```ts
import { useTranslations } from 'next-intl';
```

with:

```ts
import { useLocale, useTranslations } from 'next-intl';
import { useDistanceUnit } from '@/shared/hooks/useDistanceUnit';
import { formatDistance } from '@/shared/lib/distance';
```

Directly above `const poiDistance = useMemo(`, add:

```ts
    const [distanceUnit] = useDistanceUnit();
    const locale = useLocale();
```

Replace:

```tsx
                                distance={poiDistance ? `${poiDistance} km` : undefined}
```

with:

```tsx
                                distance={poiDistance ? formatDistance(Number(poiDistance) * 1000, distanceUnit, locale) : undefined}
```

- [ ] **Step 5: Run tests and type-check**

```bash
npx vitest run src/shared/components/map
npm run type-check
```

Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/map/NearbyPlacePopup.tsx src/shared/components/mapbox/SearchMapContainer.tsx src/shared/components/map/__tests__/NearbyPlacePopup.test.tsx
git commit -m "feat(distance): search-map place popups follow the km/miles choice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 14: Slice 2 browser check

- [ ] **Step 1: Write the QA script**

In the session scratchpad (not the repo), `npm install playwright-core`, then create `qa-nearby.mjs`:

```js
// Usage: node qa-nearby.mjs "<property page URL on :3001>" <out-prefix>
import { chromium } from 'playwright-core';

const [url, out = 'nearby'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, colorScheme: scheme, locale: 'en-US' });
    await page.goto(url, { waitUntil: 'networkidle' });
    const section = page.getByRole('heading', { name: /Nearby Places/i });
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}-${scheme}-1-strip.png`, fullPage: false });
    await page.getByRole('button', { name: 'Details' }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${out}-${scheme}-2-details.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('radio', { name: 'km' }).click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${out}-${scheme}-3-km.png` });
    await page.close();
}
await browser.close();
```

- [ ] **Step 2: Run against a real property**

Start both servers (Task 4 Step 1). Open `http://localhost:3001/en/search` for Seoul, open a hotel, copy its URL, then:

```bash
node qa-nearby.mjs "<copied URL>" slice2
```

Look at every screenshot. Expected: photo cards with ratings and distances (miles on the `en-US` browser at first, metres/km after clicking `km`); the radius steps change with the unit; the details popup shows photo, hours, contact links and Google reviews; both themes are legible. Open a Seoul search-map pin's popup and confirm its distance follows the unit too.

- [ ] **Step 3: Record findings in the task log.** Fix anything broken before moving on (new failing test first, then the fix).

---

# Slice 3 — Route from the hotel

## Task 15: `useMapboxDirections`

**Repo:** app-v2
**Files:**
- Create: `src/shared/components/mapbox/hooks/useMapboxDirections.ts`
- Test: `src/shared/components/mapbox/hooks/__tests__/useMapboxDirections.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/shared/components/mapbox/hooks/__tests__/useMapboxDirections.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/shared/lib/env', () => ({ env: { NEXT_PUBLIC_API_URL: 'http://api.test/api/v2', NEXT_PUBLIC_MAPBOX_TOKEN: 'pk.test' } }));

import { useMapboxDirections } from '@/shared/components/mapbox/hooks/useMapboxDirections';

const FROM = { lat: 37.55, lng: 126.98 };
const TO = { lat: 37.56, lng: 126.99 };
const LINE = { type: 'LineString' as const, coordinates: [[126.98, 37.55], [126.99, 37.56]] as [number, number][] };
const SECONDS: Record<string, number> = { 'driving-traffic': 660, driving: 600, walking: 1500, cycling: 720 };

function mapbox(failing: string[] = []) {
    const fn = vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        const profile = url.pathname.split('/')[4];
        if (failing.includes(profile)) return new Response(JSON.stringify({ code: 'NoRoute', routes: [] }));
        const withGeometry = url.searchParams.get('geometries') === 'geojson';
        return new Response(JSON.stringify({ code: 'Ok', routes: [{ duration: SECONDS[profile], geometry: withGeometry ? LINE : undefined }] }));
    });
    vi.stubGlobal('fetch', fn);
    return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('useMapboxDirections', () => {
    it('asks once per mode and draws only the chosen one', async () => {
        const fetchMock = mapbox();

        const { result } = renderHook(() => useMapboxDirections({ origin: FROM, destination: TO, profile: 'walking' }));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.minutes).toEqual({ driving: 10, walking: 25, cycling: 12 });
        expect(result.current.route).toEqual(LINE);
        const urls = fetchMock.mock.calls.map(([u]) => new URL(String(u)));
        expect(urls).toHaveLength(3);
        expect(urls.filter((u) => u.searchParams.get('geometries') === 'geojson').map((u) => u.pathname.split('/')[4])).toEqual(['walking']);
    });

    it('uses live traffic for driving when that is the chosen mode', async () => {
        const fetchMock = mapbox();

        const { result } = renderHook(() => useMapboxDirections({ origin: FROM, destination: TO }));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.minutes.driving).toBe(11);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('keeps the modes that worked', async () => {
        mapbox(['walking']);

        const { result } = renderHook(() => useMapboxDirections({ origin: FROM, destination: TO }));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.failed).toBe(false);
        expect(result.current.minutes).toEqual({ driving: 11, walking: null, cycling: 12 });
    });

    it('says the route failed when every mode fails', async () => {
        mapbox(['driving-traffic', 'walking', 'cycling']);

        const { result } = renderHook(() => useMapboxDirections({ origin: FROM, destination: TO }));

        await waitFor(() => expect(result.current.failed).toBe(true));
        expect(result.current.route).toBeNull();
    });

    it('does nothing while disabled', () => {
        const fetchMock = mapbox();
        renderHook(() => useMapboxDirections({ origin: FROM, destination: TO, enabled: false }));
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/shared/components/mapbox/hooks/__tests__/useMapboxDirections.test.ts`
Expected: FAIL — cannot resolve the hook.

- [ ] **Step 3: Implement**

`src/shared/components/mapbox/hooks/useMapboxDirections.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { env } from '@/shared/lib/env';
import { isAbortError } from '@/shared/lib/error';

export type DirectionsProfile = 'driving-traffic' | 'driving' | 'walking' | 'cycling';

export interface TravelTimes {
    driving: number | null;
    walking: number | null;
    cycling: number | null;
}

export interface DirectionsState {
    /** The chosen mode's line, for the map. */
    route: GeoJSON.LineString | null;
    /** Minutes by each mode — what the place card compares. */
    minutes: TravelTimes;
    loading: boolean;
    /** Every mode came back without a route. Distinct from "not asked yet". */
    failed: boolean;
}

interface UseMapboxDirectionsParams {
    origin: { lat: number; lng: number } | null;
    destination: { lat: number; lng: number } | null;
    profile?: DirectionsProfile;
    enabled?: boolean;
}

const NO_TIMES: TravelTimes = { driving: null, walking: null, cycling: null };
const IDLE: DirectionsState = { route: null, minutes: NO_TIMES, loading: false, failed: false };

interface MapboxRoute { duration: number; geometry?: GeoJSON.LineString }

/**
 * A route between two points, plus the trip time by car, on foot and by bike — v1's hook.
 *
 * One Directions call per mode; only the chosen mode asks for geometry, the others only for a
 * duration. Keyed on the coordinates' numbers, not their objects, because callers build them inline.
 */
export function useMapboxDirections({
    origin, destination, profile = 'driving-traffic', enabled = true,
}: UseMapboxDirectionsParams): DirectionsState {
    const [state, setState] = useState<DirectionsState>(IDLE);
    const oLat = origin?.lat;
    const oLng = origin?.lng;
    const dLat = destination?.lat;
    const dLng = destination?.lng;

    useEffect(() => {
        const token = env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!enabled || !token || oLat === undefined || oLng === undefined || dLat === undefined || dLng === undefined) {
            setState(IDLE);
            return;
        }

        const controller = new AbortController();
        setState((s) => ({ ...s, route: null, loading: true, failed: false }));

        const driving: DirectionsProfile = profile === 'driving-traffic' ? 'driving-traffic' : 'driving';
        const profiles = Array.from(new Set<DirectionsProfile>([profile, driving, 'walking', 'cycling']));

        const fetchOne = async (p: DirectionsProfile): Promise<{ profile: DirectionsProfile; route: MapboxRoute } | null> => {
            const withGeometry = p === profile;
            const qs = new URLSearchParams({ access_token: token, overview: withGeometry ? 'full' : 'false' });
            if (withGeometry) qs.set('geometries', 'geojson');
            try {
                const res = await fetch(
                    `https://api.mapbox.com/directions/v5/mapbox/${p}/${oLng},${oLat};${dLng},${dLat}?${qs.toString()}`,
                    { signal: controller.signal },
                );
                if (!res.ok) return null;
                const data = await res.json() as { code?: string; routes?: MapboxRoute[] };
                const route = data.code === 'Ok' ? data.routes?.[0] : undefined;
                return route ? { profile: p, route } : null;
            } catch (e) {
                if (isAbortError(e)) throw e;
                return null;
            }
        };

        Promise.all(profiles.map(fetchOne))
            .then((results) => {
                const minutes: TravelTimes = { ...NO_TIMES };
                let route: GeoJSON.LineString | null = null;
                for (const r of results) {
                    if (!r) continue;
                    const mins = Math.round(r.route.duration / 60);
                    if (r.profile === 'walking') minutes.walking = mins;
                    else if (r.profile === 'cycling') minutes.cycling = mins;
                    else if (r.profile === driving) minutes.driving = mins;
                    if (r.profile === profile && r.route.geometry) route = r.route.geometry;
                }
                setState({ route, minutes, loading: false, failed: results.every((r) => r === null) });
            })
            .catch((e) => {
                if (!isAbortError(e)) setState({ ...IDLE, failed: true });
            });

        return () => controller.abort();
    }, [enabled, oLat, oLng, dLat, dLng, profile]);

    return state;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/shared/components/mapbox/hooks/__tests__/useMapboxDirections.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/mapbox/hooks/useMapboxDirections.ts src/shared/components/mapbox/hooks/__tests__/useMapboxDirections.test.ts
git commit -m "feat(map): directions hook with drive/walk/bike times

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 16: `PlaceCallout` + route on the map

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/components/nearby/PlaceCallout.tsx`
- Modify: `src/features/hotels/components/nearby/NearbyExplorer.tsx`
- Test: `src/features/hotels/__tests__/PlaceCallout.test.tsx`; extend `NearbyExplorer.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/features/hotels/__tests__/PlaceCallout.test.tsx`:

```tsx
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { DirectionsState } from '@/shared/components/mapbox/hooks/useMapboxDirections';
import { PlaceCallout } from '@/features/hotels/components/nearby/PlaceCallout';
import { HOTEL, PALETTE, gem, renderWithIntl } from './nearby-fixtures';

const READY: DirectionsState = { route: null, minutes: { driving: 10, walking: 25, cycling: 12 }, loading: false, failed: false };

function props(overrides: Partial<React.ComponentProps<typeof PlaceCallout>> = {}) {
    return {
        gem: gem(), hotel: HOTEL, unit: 'km' as const, directions: READY, profile: 'driving-traffic' as const,
        onProfileChange: vi.fn(), onDetails: vi.fn(), onClose: vi.fn(), palette: PALETTE, ...overrides,
    };
}

describe('PlaceCallout', () => {
    it('shows the place, how far it is, and the time by each mode', () => {
        renderWithIntl(<PlaceCallout {...props()} />);
        expect(screen.getByRole('region', { name: 'Cafe Onion' })).toBeInTheDocument();
        expect(screen.getByText('360 m away')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Drive/ })).toHaveTextContent('10 min');
        expect(screen.getByRole('radio', { name: /Walk/ })).toHaveTextContent('25 min');
        expect(screen.getByRole('radio', { name: /Bike/ })).toHaveTextContent('12 min');
        expect(screen.getByRole('radio', { name: /Drive/ })).toHaveAttribute('aria-checked', 'true');
    });

    it('switches the drawn route by mode', () => {
        const p = props();
        renderWithIntl(<PlaceCallout {...p} />);
        fireEvent.click(screen.getByRole('radio', { name: /Walk/ }));
        expect(p.onProfileChange).toHaveBeenCalledWith('walking');
    });

    it('says when there is no route', () => {
        renderWithIntl(<PlaceCallout {...props({ directions: { ...READY, minutes: { driving: null, walking: null, cycling: null }, failed: true } })} />);
        expect(screen.getByText('Route unavailable')).toBeInTheDocument();
        expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('says while it is finding one', () => {
        renderWithIntl(<PlaceCallout {...props({ directions: { ...READY, loading: true } })} />);
        expect(screen.getByText('Finding a route…')).toBeInTheDocument();
    });

    it('opens details, links to Google Maps, and closes', () => {
        const p = props();
        renderWithIntl(<PlaceCallout {...p} />);
        fireEvent.click(screen.getByRole('button', { name: 'Details' }));
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(p.onDetails).toHaveBeenCalledWith(p.gem);
        expect(p.onClose).toHaveBeenCalled();
        expect(screen.getByRole('link', { name: 'View on Maps' }).getAttribute('href')).toContain('query_place_id=g-1');
    });

    it('offers no trip button before the trip planner is wired in', () => {
        renderWithIntl(<PlaceCallout {...props()} />);
        expect(screen.queryByRole('button', { name: 'Add to trip' })).not.toBeInTheDocument();
    });

    it('disables "Add to trip" when the trip is full', () => {
        renderWithIntl(<PlaceCallout {...props({ trip: { inTrip: false, full: true, onToggle: vi.fn() } })} />);
        expect(screen.getByRole('button', { name: 'Add to trip' })).toBeDisabled();
    });

    it('offers to remove a place already in the trip', () => {
        const onToggle = vi.fn();
        renderWithIntl(<PlaceCallout {...props({ trip: { inTrip: true, full: true, onToggle } })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Remove from trip' }));
        expect(onToggle).toHaveBeenCalled();
    });
});
```

Append to `NearbyExplorer.test.tsx` — add this mock next to the other `vi.mock` calls at the top:

```tsx
vi.mock('@/shared/components/mapbox/hooks/useMapboxDirections', () => ({
    useMapboxDirections: vi.fn(({ enabled }: { enabled?: boolean }) => (
        enabled
            ? { route: null, minutes: { driving: 10, walking: 25, cycling: 12 }, loading: false, failed: false }
            : { route: null, minutes: { driving: null, walking: null, cycling: null }, loading: false, failed: false }
    )),
}));
```

and this test inside the `describe`:

```tsx
    it('shows the route card for a place picked on the map', () => {
        explorer();
        fireEvent.click(screen.getByRole('button', { name: 'pin Cafe Onion' }));
        expect(screen.getByRole('region', { name: 'Cafe Onion' })).toHaveTextContent('25 min');
    });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/PlaceCallout.test.tsx src/features/hotels/__tests__/NearbyExplorer.test.tsx`
Expected: FAIL — `PlaceCallout` missing; explorer shows no region.

- [ ] **Step 3: Implement `PlaceCallout`**

`src/features/hotels/components/nearby/PlaceCallout.tsx`:

```tsx
'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bike, Car, Footprints, X, type LucideIcon } from 'lucide-react';
import type { NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import type { DirectionsProfile, DirectionsState, TravelTimes } from '@/shared/components/mapbox/hooks/useMapboxDirections';
import { formatDistance, haversineMeters, type DistanceUnit } from '@/shared/lib/distance';
import { BRAND } from '@/shared/lib/palette';
import { googleMapsUrl } from './links';
import { MAX_TRIP_STOPS, type LatLng, type NearbyPalette } from './types';

export interface TripControl {
    inTrip: boolean;
    full: boolean;
    onToggle: () => void;
}

interface PlaceCalloutProps {
    gem: NearbyGem;
    hotel: LatLng;
    unit: DistanceUnit;
    directions: DirectionsState;
    profile: DirectionsProfile;
    onProfileChange: (profile: DirectionsProfile) => void;
    onDetails: (gem: NearbyGem) => void;
    onClose: () => void;
    /** Present once the trip planner is wired in. */
    trip?: TripControl;
    palette: NearbyPalette;
}

const MODES: { profile: DirectionsProfile; label: 'drive' | 'walk' | 'bike'; icon: LucideIcon; pick: (m: TravelTimes) => number | null }[] = [
    { profile: 'driving-traffic', label: 'drive', icon: Car,        pick: (m) => m.driving },
    { profile: 'walking',         label: 'walk',  icon: Footprints, pick: (m) => m.walking },
    { profile: 'cycling',         label: 'bike',  icon: Bike,       pick: (m) => m.cycling },
];

/** The selected place, over the map: how far, how long by each mode, and what to do next. */
export function PlaceCallout({
    gem, hotel, unit, directions, profile, onProfileChange, onDetails, onClose, trip, palette,
}: PlaceCalloutProps) {
    const t = useTranslations('property.nearby');
    const tAll = useTranslations();
    const locale = useLocale();
    const name = gem.translatedName ?? gem.name;
    const distance = formatDistance(haversineMeters(hotel, gem.coordinates), unit, locale);

    const button: React.CSSProperties = {
        padding: '6px 10px', borderRadius: 10, border: `1px solid ${palette.cardBorder}`, background: palette.iconBg,
        color: palette.title, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
    };

    let times: React.ReactNode;
    if (directions.loading) {
        times = <p style={{ margin: 0, fontSize: 13, color: palette.muted }}>{t('loadingRoute')}</p>;
    } else if (directions.failed) {
        times = <p role="status" style={{ margin: 0, fontSize: 13, color: palette.muted }}>{t('routeUnavailable')}</p>;
    } else {
        times = (
            <div role="radiogroup" aria-label={t('travelMode')} style={{ display: 'flex', gap: 6 }}>
                {MODES.map((m) => {
                    const Icon = m.icon;
                    const mins = m.pick(directions.minutes);
                    const active = m.profile === profile || (m.label === 'drive' && profile === 'driving');
                    return (
                        <button
                            key={m.label}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={`${t(m.label)} ${mins !== null ? t('minutes', { count: mins }) : '—'}`}
                            onClick={() => onProfileChange(m.profile)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                padding: '6px 4px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                                border: `1px solid ${active ? BRAND.primaryStrong : palette.cardBorder}`,
                                background: active ? BRAND.primaryStrong : 'transparent',
                                color: active ? '#fff' : palette.text,
                            }}
                        >
                            <Icon size={14} aria-hidden />
                            {mins !== null ? t('minutes', { count: mins }) : '—'}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <section
            aria-label={gem.name}
            style={{
                position: 'absolute', top: 12, left: 12, zIndex: 20, width: 'min(300px, calc(100% - 24px))',
                padding: 14, borderRadius: 14, background: palette.bg, color: palette.text,
                border: `1px solid ${palette.cardBorder}`, boxShadow: '0 10px 30px rgba(0,0,0,.25)',
                display: 'flex', flexDirection: 'column', gap: 10,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: palette.title, lineHeight: 1.25 }}>{name}</div>
                    <div style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>{t('away', { distance })}</div>
                </div>
                <button type="button" aria-label={t('close')} onClick={onClose} style={{ ...button, padding: 4, display: 'flex' }}>
                    <X size={14} aria-hidden />
                </button>
            </div>
            {times}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <a href={googleMapsUrl(gem)} target="_blank" rel="noopener noreferrer" style={button}>
                    {tAll('property.mapOverlay.viewOnMaps')}
                </a>
                <button type="button" onClick={() => onDetails(gem)} style={button}>{t('details')}</button>
                {trip && (
                    <button
                        type="button"
                        onClick={trip.onToggle}
                        disabled={trip.full && !trip.inTrip}
                        title={trip.full && !trip.inTrip ? t('trip.max', { max: MAX_TRIP_STOPS }) : undefined}
                        style={{ ...button, opacity: trip.full && !trip.inTrip ? 0.5 : 1 }}
                    >
                        {trip.inTrip ? t('removeFromTrip') : t('addToTrip')}
                    </button>
                )}
            </div>
        </section>
    );
}
```

- [ ] **Step 4: Wire the route into `NearbyExplorer`**

Add imports:

```ts
import { useMapboxDirections, type DirectionsProfile } from '@/shared/components/mapbox/hooks/useMapboxDirections';
import { PlaceCallout } from './PlaceCallout';
```

Under `const [detailsId, setDetailsId] = useState<string | null>(null);` add:

```ts
    const [profile, setProfile] = useState<DirectionsProfile>('driving-traffic');
```

Under `const detailsGem = …;` add:

```ts
    const placeRoute = useMapboxDirections({
        origin: coordinates,
        destination: active?.coordinates ?? null,
        profile,
        enabled: active !== null,
    });
```

Replace the self-closing `<NearbyMap … route={null} height={MAP_HEIGHT} />` with:

```tsx
            <NearbyMap
                mapRef={mapRef}
                hotel={coordinates}
                hotelLabel={hotelName || t('hotel')}
                places={gems}
                activeId={active?.id ?? null}
                onSelect={select}
                mapStyle={palette.mapStyle}
                route={placeRoute.route}
                height={MAP_HEIGHT}
            >
                {active && (
                    <PlaceCallout
                        gem={active}
                        hotel={coordinates}
                        unit={unit}
                        directions={placeRoute}
                        profile={profile}
                        onProfileChange={setProfile}
                        onDetails={showDetails}
                        onClose={() => setActiveId(null)}
                        palette={palette}
                    />
                )}
            </NearbyMap>
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/features/hotels/__tests__/PlaceCallout.test.tsx src/features/hotels/__tests__/NearbyExplorer.test.tsx`
Expected: PASS.

- [ ] **Step 6: Type-check and commit**

```bash
npm run type-check
git add src/features/hotels/components/nearby/PlaceCallout.tsx src/features/hotels/components/nearby/NearbyExplorer.tsx src/features/hotels/__tests__/PlaceCallout.test.tsx src/features/hotels/__tests__/NearbyExplorer.test.tsx
git commit -m "feat(nearby): route from the hotel with drive/walk/bike times

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Browser check** — rerun `qa-nearby.mjs` with an added step that clicks the first card's select button (`page.getByRole('button', { name: <first place name> })`) and screenshots the map. Expected: a blue line from the hotel to the place, three times in the callout, Walk switches the line.

---

# Slice 4 — Directions to the hotel

## Task 17: `useOriginSearch`

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/hooks/useOriginSearch.ts`
- Test: `src/features/hotels/__tests__/useOriginSearch.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/features/hotels/__tests__/useOriginSearch.test.ts`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/shared/lib/env', () => ({ env: { NEXT_PUBLIC_API_URL: 'http://api.test/api/v2', NEXT_PUBLIC_MAPBOX_TOKEN: 'pk.test' } }));

import { useOriginSearch } from '@/features/hotels/hooks/useOriginSearch';

const HOTEL = { lat: 37.55, lng: 126.98 };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

function api(handler: (url: URL) => Response) {
    const fn = vi.fn(async (input: string | URL) => handler(new URL(String(input))));
    vi.stubGlobal('fetch', fn);
    return fn;
}

function geolocation(impl: (ok: (p: GeolocationPosition) => void, fail: (e: unknown) => void) => void) {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: impl } });
}

afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'geolocation');
});

/** Real timers: the debounce is 400 ms, and `waitFor` polls on real time (it would hang on faked timers). */
const pause = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

describe('useOriginSearch', () => {
    it('waits for typing to pause, then searches near the hotel', async () => {
        const fetchMock = api(() => json({ predictions: [{ place_id: 'p-1', description: 'Seoul Station, Seoul' }] }));
        const { result } = renderHook(() => useOriginSearch({ hotel: HOTEL }));

        act(() => result.current.search('seoul st'));
        expect(fetchMock).not.toHaveBeenCalled();

        await waitFor(() => expect(result.current.options).toEqual([{ id: 'p-1', name: 'Seoul Station, Seoul' }]));
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const url = new URL(String(fetchMock.mock.calls[0][0]));
        expect(url.pathname).toBe('/api/v2/google/search');
        expect(url.searchParams.get('input')).toBe('seoul st');
        expect(url.searchParams.get('proximity')).toBe('37.55,126.98');
    });

    it('searches once for a burst of typing', async () => {
        const fetchMock = api(() => json({ predictions: [] }));
        const { result } = renderHook(() => useOriginSearch({ hotel: HOTEL }));

        act(() => result.current.search('s'));
        act(() => result.current.search('se'));
        act(() => result.current.search('seo'));
        await pause(500);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('input')).toBe('seo');
    });

    it('clears without searching when the box is emptied', async () => {
        const fetchMock = api(() => json({ predictions: [] }));
        const { result } = renderHook(() => useOriginSearch({ hotel: HOTEL }));

        act(() => result.current.search('   '));
        await pause(500);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.current.options).toEqual([]);
    });

    it('reports a failed search', async () => {
        api(() => json({}, 500));
        const { result } = renderHook(() => useOriginSearch({ hotel: HOTEL }));

        act(() => result.current.search('seoul'));

        await waitFor(() => expect(result.current.error).toBe('search'));
    });

    it('turns a picked suggestion into an origin', async () => {
        api(() => json({ result: { geometry: { location: { lat: 37.5547, lng: 126.9707 } } } }));
        const { result } = renderHook(() => useOriginSearch({ hotel: HOTEL }));

        await act(async () => { await result.current.select({ id: 'p-1', name: 'Seoul Station, Seoul' }); });

        expect(result.current.origin).toEqual({ id: 'p-1', name: 'Seoul Station, Seoul', lat: 37.5547, lng: 126.9707 });
        expect(result.current.query).toBe('Seoul Station, Seoul');
    });

    it('starts from the viewer’s location, named by reverse geocoding', async () => {
        geolocation((ok) => ok({ coords: { latitude: 37.57, longitude: 126.99 } } as GeolocationPosition));
        api(() => json({ results: [{ place_id: 'p-home', formatted_address: '1 Jongno, Seoul' }] }));
        const { result } = renderHook(() => useOriginSearch({ hotel: HOTEL }));

        await act(async () => { await result.current.locate(); });

        await waitFor(() => expect(result.current.origin).toEqual({ id: 'p-home', name: '1 Jongno, Seoul', lat: 37.57, lng: 126.99 }));
    });

    it('says when the location is refused', async () => {
        geolocation((_ok, fail) => fail({ code: 1 }));
        const { result } = renderHook(() => useOriginSearch({ hotel: HOTEL }));

        await act(async () => { await result.current.locate(); });

        expect(result.current.error).toBe('locate');
        expect(result.current.origin).toBeNull();
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/useOriginSearch.test.ts`
Expected: FAIL — cannot resolve the hook.

- [ ] **Step 3: Implement**

`src/features/hotels/hooks/useOriginSearch.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@/shared/lib/env';
import { isAbortError } from '@/shared/lib/error';
import type { LatLng } from '@/features/hotels/components/nearby/types';

export interface OriginOption {
    id: string;
    name: string;
}

export interface Origin extends LatLng {
    id: string;
    name: string;
}

export type OriginError = 'search' | 'locate' | null;

const DEBOUNCE_MS = 400;

function currentPosition(): Promise<LatLng> {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            reject,
            { enableHighAccuracy: true, timeout: 8000 },
        );
    });
}

/** The viewer's position only if they already allowed it — this never shows a prompt. */
async function positionIfPermitted(): Promise<LatLng | null> {
    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.geolocation) return null;
    try {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        return status.state === 'granted' ? await currentPosition() : null;
    } catch {
        return null;
    }
}

/**
 * "Where from?" for directions to the hotel — v1's useGoogleSearch, on api-v2's
 * /google/search and /google/geocode.
 *
 * Suggestions lean towards the viewer when they have already shared their location, else towards
 * the hotel. Asking for the location happens only behind the "Use my location" button.
 */
export function useOriginSearch({ hotel }: { hotel: LatLng }) {
    const api = env.NEXT_PUBLIC_API_URL;
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<OriginOption[]>([]);
    const [searching, setSearching] = useState(false);
    const [locating, setLocating] = useState(false);
    const [origin, setOrigin] = useState<Origin | null>(null);
    const [error, setError] = useState<OriginError>(null);
    const [viewer, setViewer] = useState<LatLng | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const controller = useRef<AbortController | null>(null);

    useEffect(() => {
        let cancelled = false;
        positionIfPermitted().then((pos) => { if (!cancelled) setViewer(pos); });
        return () => {
            cancelled = true;
            if (timer.current) clearTimeout(timer.current);
            controller.current?.abort();
        };
    }, []);

    const biasLat = viewer?.lat ?? hotel.lat;
    const biasLng = viewer?.lng ?? hotel.lng;

    const search = useCallback((text: string) => {
        setQuery(text);
        setError(null);
        if (timer.current) clearTimeout(timer.current);
        controller.current?.abort();
        if (!text.trim()) {
            setOptions([]);
            return;
        }
        timer.current = setTimeout(async () => {
            const ctl = new AbortController();
            controller.current = ctl;
            setSearching(true);
            try {
                const qs = new URLSearchParams({ input: text.trim(), proximity: `${biasLat},${biasLng}` });
                const res = await fetch(`${api}/google/search?${qs.toString()}`, { signal: ctl.signal });
                if (!res.ok) throw new Error(`search ${res.status}`);
                const data = await res.json() as { predictions?: { place_id: string; description: string }[] };
                setOptions((data.predictions ?? []).map((p) => ({ id: p.place_id, name: p.description })));
            } catch (e) {
                if (isAbortError(e)) return;
                setOptions([]);
                setError('search');
            } finally {
                if (!ctl.signal.aborted) setSearching(false);
            }
        }, DEBOUNCE_MS);
    }, [api, biasLat, biasLng]);

    const select = useCallback(async (option: OriginOption) => {
        setQuery(option.name);
        setOptions([]);
        setError(null);
        setSearching(true);
        try {
            const res = await fetch(`${api}/google/geocode?place_id=${encodeURIComponent(option.id)}`);
            if (!res.ok) throw new Error(`geocode ${res.status}`);
            const data = await res.json() as { result?: { geometry?: { location?: LatLng } } };
            const location = data.result?.geometry?.location;
            if (!location) throw new Error('geocode: no location');
            setOrigin({ id: option.id, name: option.name, lat: location.lat, lng: location.lng });
        } catch {
            setError('search');
        } finally {
            setSearching(false);
        }
    }, [api]);

    const locate = useCallback(async () => {
        setError(null);
        setLocating(true);
        try {
            const pos = await currentPosition();
            let id = 'current-location';
            let name = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
            try {
                const res = await fetch(`${api}/google/geocode?lat=${pos.lat}&lng=${pos.lng}`);
                const data = await res.json() as { results?: { place_id?: string; formatted_address?: string }[] };
                const first = data.results?.[0];
                if (first?.formatted_address) {
                    name = first.formatted_address;
                    id = first.place_id ?? id;
                }
            } catch {
                /* the coordinates alone are enough to route from */
            }
            setOrigin({ id, name, lat: pos.lat, lng: pos.lng });
            setQuery(name);
            setOptions([]);
        } catch {
            setError('locate');
        } finally {
            setLocating(false);
        }
    }, [api]);

    const clear = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        controller.current?.abort();
        setQuery('');
        setOptions([]);
        setOrigin(null);
        setError(null);
        setSearching(false);
    }, []);

    return { query, options, searching, locating, origin, error, search, select, locate, clear };
}

export type OriginSearch = ReturnType<typeof useOriginSearch>;
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/hotels/__tests__/useOriginSearch.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/hotels/hooks/useOriginSearch.ts src/features/hotels/__tests__/useOriginSearch.test.ts
git commit -m "feat(nearby): where-from search and locate me for directions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 18: `DirectionsPanel`, origin route, fit-to-route

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/components/nearby/map-bounds.ts`
- Create: `src/features/hotels/components/nearby/DirectionsPanel.tsx`
- Modify: `src/features/hotels/components/nearby/NearbyExplorer.tsx`
- Test: `src/features/hotels/__tests__/DirectionsPanel.test.tsx`; append to `nearby-helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/features/hotels/__tests__/nearby-helpers.test.ts`:

```ts
import { vi } from 'vitest';
import { fitToPoints } from '@/features/hotels/components/nearby/map-bounds';

describe('fitToPoints', () => {
    it('fits the map to the box around the points', () => {
        const map = { fitBounds: vi.fn() };
        fitToPoints(map as never, [{ lat: 37.55, lng: 126.98 }, { lat: 37.6, lng: 126.9 }]);
        expect(map.fitBounds).toHaveBeenCalledWith([[126.9, 37.55], [126.98, 37.6]], { padding: 60, duration: 800 });
    });

    it('leaves the map alone for fewer than two points or no map', () => {
        const map = { fitBounds: vi.fn() };
        fitToPoints(map as never, [{ lat: 37.55, lng: 126.98 }]);
        fitToPoints(null, [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }]);
        expect(map.fitBounds).not.toHaveBeenCalled();
    });
});
```

(Merge the `vi` import into the file's existing `vitest` import line.)

`src/features/hotels/__tests__/DirectionsPanel.test.tsx`:

```tsx
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { OriginSearch } from '@/features/hotels/hooks/useOriginSearch';
import type { DirectionsState } from '@/shared/components/mapbox/hooks/useMapboxDirections';
import { DirectionsPanel } from '@/features/hotels/components/nearby/DirectionsPanel';
import { PALETTE, renderWithIntl } from './nearby-fixtures';

const IDLE: DirectionsState = { route: null, minutes: { driving: null, walking: null, cycling: null }, loading: false, failed: false };

function originSearch(overrides: Partial<OriginSearch> = {}): OriginSearch {
    return {
        query: '', options: [], searching: false, locating: false, origin: null, error: null,
        search: vi.fn(), select: vi.fn(), locate: vi.fn(), clear: vi.fn(), ...overrides,
    } as OriginSearch;
}

function props(overrides: Partial<React.ComponentProps<typeof DirectionsPanel>> = {}) {
    return {
        open: true, onOpenChange: vi.fn(), search: originSearch(), profile: 'driving-traffic' as const,
        onProfileChange: vi.fn(), directions: IDLE, palette: PALETTE, ...overrides,
    };
}

describe('DirectionsPanel', () => {
    it('is a single button while closed', () => {
        const p = props({ open: false });
        renderWithIntl(<DirectionsPanel {...p} />);
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Get directions' }));
        expect(p.onOpenChange).toHaveBeenCalledWith(true);
    });

    it('searches as the viewer types and picks a suggestion', () => {
        const search = originSearch({ options: [{ id: 'p-1', name: 'Seoul Station, Seoul' }] });
        renderWithIntl(<DirectionsPanel {...props({ search })} />);

        fireEvent.change(screen.getByRole('searchbox', { name: 'Where from?' }), { target: { value: 'seoul' } });
        expect(search.search).toHaveBeenCalledWith('seoul');

        fireEvent.click(screen.getByRole('option', { name: 'Seoul Station, Seoul' }));
        expect(search.select).toHaveBeenCalledWith({ id: 'p-1', name: 'Seoul Station, Seoul' });
    });

    it('locates the viewer, and says so plainly when it cannot', () => {
        const search = originSearch({ error: 'locate' });
        renderWithIntl(<DirectionsPanel {...props({ search })} />);

        fireEvent.click(screen.getByRole('button', { name: 'Use my location' }));
        expect(search.locate).toHaveBeenCalled();
        expect(screen.getByText("Couldn't get your location. Type a starting point instead.")).toBeInTheDocument();
    });

    it('switches the travel mode', () => {
        const p = props();
        renderWithIntl(<DirectionsPanel {...p} />);
        fireEvent.click(screen.getByRole('radio', { name: 'Walk' }));
        expect(p.onProfileChange).toHaveBeenCalledWith('walking');
    });

    it('gives the time to the hotel by the chosen mode', () => {
        const search = originSearch({ origin: { id: 'p-1', name: 'Seoul Station', lat: 37.55, lng: 126.97 } });
        renderWithIntl(<DirectionsPanel {...props({ search, profile: 'walking', directions: { ...IDLE, minutes: { driving: 9, walking: 31, cycling: 14 } } })} />);
        expect(screen.getByText('31 min to the hotel')).toBeInTheDocument();
    });

    it('closes', () => {
        const p = props();
        renderWithIntl(<DirectionsPanel {...p} />);
        fireEvent.click(screen.getByRole('button', { name: 'Hide directions' }));
        expect(p.onOpenChange).toHaveBeenCalledWith(false);
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/DirectionsPanel.test.tsx src/features/hotels/__tests__/nearby-helpers.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement `map-bounds.ts`**

`src/features/hotels/components/nearby/map-bounds.ts`:

```ts
import type { MapRef } from 'react-map-gl/mapbox';
import type { LatLng } from './types';

/** Fit the map to the box around `points` — a route's ends, or a trip's stops. */
export function fitToPoints(map: Pick<MapRef, 'fitBounds'> | null, points: LatLng[], padding = 60) {
    if (!map || points.length < 2) return;
    const lngs = points.map((p) => p.lng);
    const lats = points.map((p) => p.lat);
    map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding, duration: 800 },
    );
}
```

- [ ] **Step 4: Implement `DirectionsPanel`**

`src/features/hotels/components/nearby/DirectionsPanel.tsx`:

```tsx
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Bike, Car, Footprints, LocateFixed, Navigation, TrafficCone, X, type LucideIcon } from 'lucide-react';
import type { OriginSearch } from '@/features/hotels/hooks/useOriginSearch';
import type { DirectionsProfile, DirectionsState, TravelTimes } from '@/shared/components/mapbox/hooks/useMapboxDirections';
import { BRAND } from '@/shared/lib/palette';
import type { NearbyPalette } from './types';

interface DirectionsPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    search: OriginSearch;
    profile: DirectionsProfile;
    onProfileChange: (profile: DirectionsProfile) => void;
    /** The origin → hotel route. */
    directions: DirectionsState;
    palette: NearbyPalette;
}

const PROFILES: { profile: DirectionsProfile; label: 'traffic' | 'drive' | 'walk' | 'bike'; icon: LucideIcon }[] = [
    { profile: 'driving-traffic', label: 'traffic', icon: TrafficCone },
    { profile: 'driving',         label: 'drive',   icon: Car },
    { profile: 'walking',         label: 'walk',    icon: Footprints },
    { profile: 'cycling',         label: 'bike',    icon: Bike },
];

function minutesFor(profile: DirectionsProfile, minutes: TravelTimes): number | null {
    if (profile === 'walking') return minutes.walking;
    if (profile === 'cycling') return minutes.cycling;
    return minutes.driving;
}

/** Directions *to* the hotel: a starting point (typed, or the viewer's location) and a mode. */
export function DirectionsPanel({ open, onOpenChange, search, profile, onProfileChange, directions, palette }: DirectionsPanelProps) {
    const t = useTranslations('property.nearby');

    const chip: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
        border: `1px solid ${palette.cardBorder}`, background: palette.cardBg, color: palette.title,
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
    };

    if (!open) {
        return (
            <div>
                <button type="button" aria-expanded={false} onClick={() => onOpenChange(true)} style={chip}>
                    <Navigation size={15} aria-hidden />{t('directions.open')}
                </button>
            </div>
        );
    }

    const minutes = minutesFor(profile, directions.minutes);
    let result: React.ReactNode = null;
    if (search.origin) {
        if (directions.loading) result = t('loadingRoute');
        else if (directions.failed || minutes === null) result = t('routeUnavailable');
        else result = t('directions.toHotel', { minutes });
    }

    return (
        <section
            aria-label={t('directions.open')}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, background: palette.cardBg, border: `1px solid ${palette.cardBorder}` }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                    type="search"
                    aria-label={t('directions.whereFrom')}
                    placeholder={t('directions.whereFrom')}
                    value={search.query}
                    onChange={(e) => search.search(e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: '9px 12px', borderRadius: 10, border: `1px solid ${palette.cardBorder}`, background: palette.bg, color: palette.title, fontSize: 15 }}
                />
                <button type="button" onClick={() => search.locate()} disabled={search.locating} style={chip}>
                    <LocateFixed size={15} aria-hidden />
                    {search.locating ? t('directions.locating') : t('directions.locateMe')}
                </button>
                <button type="button" aria-label={t('directions.close')} onClick={() => onOpenChange(false)} style={{ ...chip, padding: 8 }}>
                    <X size={15} aria-hidden />
                </button>
            </div>

            {search.options.length > 0 && (
                <div role="listbox" aria-label={t('directions.whereFrom')} style={{ display: 'flex', flexDirection: 'column', borderRadius: 10, border: `1px solid ${palette.cardBorder}`, overflow: 'hidden' }}>
                    {search.options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => search.select(option)}
                            style={{ textAlign: 'left', padding: '9px 12px', border: 'none', borderBottom: `1px solid ${palette.hairline}`, background: palette.bg, color: palette.text, fontSize: 14, cursor: 'pointer' }}
                        >
                            {option.name}
                        </button>
                    ))}
                </div>
            )}

            {search.error === 'locate' && <p role="status" style={{ margin: 0, fontSize: 13, color: palette.muted }}>{t('directions.locationDenied')}</p>}
            {search.error === 'search' && <p role="status" style={{ margin: 0, fontSize: 13, color: palette.muted }}>{t('directions.searchFailed')}</p>}

            <div role="radiogroup" aria-label={t('travelMode')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PROFILES.map((p) => {
                    const Icon = p.icon;
                    const active = p.profile === profile;
                    return (
                        <button
                            key={p.profile}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => onProfileChange(p.profile)}
                            style={{
                                ...chip, padding: '6px 12px', fontSize: 13,
                                border: `1px solid ${active ? BRAND.primaryStrong : palette.cardBorder}`,
                                background: active ? BRAND.primaryStrong : palette.cardBg,
                                color: active ? '#fff' : palette.text,
                            }}
                        >
                            <Icon size={14} aria-hidden />{t(p.label)}
                        </button>
                    );
                })}
            </div>

            {result && <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: palette.title }}>{result}</p>}
        </section>
    );
}
```

- [ ] **Step 5: Wire it into `NearbyExplorer`**

Add imports:

```ts
import { useOriginSearch } from '@/features/hotels/hooks/useOriginSearch';
import { DirectionsPanel } from './DirectionsPanel';
import { fitToPoints } from './map-bounds';
```

Replace the `placeRoute` block from Task 16:

```ts
    const placeRoute = useMapboxDirections({
        origin: coordinates,
        destination: active?.coordinates ?? null,
        profile,
        enabled: active !== null,
    });
```

with:

```ts
    const [directionsOpen, setDirectionsOpen] = useState(false);
    const origin = useOriginSearch({ hotel: coordinates });
    // While a where-from route is showing, it replaces the place route (v1 behaviour).
    const originActive = directionsOpen && origin.origin !== null;
    const originRoute = useMapboxDirections({
        origin: origin.origin,
        destination: coordinates,
        profile,
        enabled: originActive,
    });
    const placeRoute = useMapboxDirections({
        origin: coordinates,
        destination: active?.coordinates ?? null,
        profile,
        enabled: active !== null && !originActive,
    });
    const route = originActive ? originRoute.route : placeRoute.route;

    const originLat = origin.origin?.lat;
    const originLng = origin.origin?.lng;
    useEffect(() => {
        if (!originActive || originLat === undefined || originLng === undefined) return;
        fitToPoints(mapRef.current, [{ lat: originLat, lng: originLng }, { lat: coordinates.lat, lng: coordinates.lng }]);
    }, [originActive, originLat, originLng, coordinates.lat, coordinates.lng]);

    const { clear: clearOrigin } = origin;
    const changeDirectionsOpen = useCallback((open: boolean) => {
        setDirectionsOpen(open);
        if (!open) clearOrigin();
    }, [clearOrigin]);
```

In the `<NearbyMap>` props, replace `route={placeRoute.route}` with:

```tsx
                route={route}
                origin={originActive ? origin.origin : null}
```

Change the callout condition `{active && (` to `{active && !originActive && (`.

Directly after the closing `</NearbyMap>`, add:

```tsx
            <DirectionsPanel
                open={directionsOpen}
                onOpenChange={changeDirectionsOpen}
                search={origin}
                profile={profile}
                onProfileChange={setProfile}
                directions={originRoute}
                palette={palette}
            />
```

- [ ] **Step 6: Run the tests**

```bash
npx vitest run src/features/hotels/__tests__
npm run type-check
```

Expected: PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/hotels/components/nearby/map-bounds.ts src/features/hotels/components/nearby/DirectionsPanel.tsx src/features/hotels/components/nearby/NearbyExplorer.tsx src/features/hotels/__tests__/DirectionsPanel.test.tsx src/features/hotels/__tests__/nearby-helpers.test.ts
git commit -m "feat(nearby): directions to the hotel from a typed place or my location

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Browser check** — in the QA script, click "Get directions", type `Seoul Station`, wait 1.5 s, click the first option, wait 3 s, screenshot. Expected: an origin marker, a route to the hotel, the map fitted to both, "N min to the hotel" under the mode chips; switching Walk changes the time and the line. Grant geolocation in a second run (`browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: 37.57, longitude: 126.99 } })`) and click "Use my location".

---

# Slice 5 — Trip planner

## Task 19: `useTripPlanner`

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/hooks/useTripPlanner.ts`
- Test: `src/features/hotels/__tests__/useTripPlanner.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/features/hotels/__tests__/useTripPlanner.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Search } from 'lucide-react';
import type { NearbyGem } from '@/features/hotels/hooks/useNearbyGems';

vi.mock('@/shared/lib/env', () => ({ env: { NEXT_PUBLIC_API_URL: 'http://api.test/api/v2', NEXT_PUBLIC_MAPBOX_TOKEN: 'pk.test' } }));

import { useTripPlanner } from '@/features/hotels/hooks/useTripPlanner';

const HOTEL = { lat: 37.55, lng: 126.98 };
const LINE = { type: 'LineString' as const, coordinates: [[126.98, 37.55], [126.99, 37.56]] as [number, number][] };

const stop = (i: number): NearbyGem => ({
    id: `g-${i}`, name: `Place ${i}`, category: 'cafe', rating: 4.5, imageUrl: '', icon: Search,
    coordinates: { lat: 37.56, lng: 127 + i }, isStub: false,
});

function optimizer(body: unknown, status = 200) {
    const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fn);
    return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('useTripPlanner', () => {
    it('holds at most 11 stops', () => {
        const { result } = renderHook(() => useTripPlanner({ hotel: HOTEL }));
        for (let i = 0; i < 11; i++) act(() => result.current.toggle(stop(i)));
        expect(result.current.stops).toHaveLength(11);
        expect(result.current.full).toBe(true);

        act(() => result.current.toggle(stop(11)));

        expect(result.current.stops).toHaveLength(11);
        expect(result.current.status).toBe('full');
    });

    it('optimizes a round trip that starts at the hotel', async () => {
        const fetchMock = optimizer({ code: 'Ok', trips: [{ geometry: LINE, duration: 1500 }] });
        const { result } = renderHook(() => useTripPlanner({ hotel: HOTEL }));
        act(() => result.current.toggle(stop(1)));

        await act(async () => { await result.current.optimize(); });

        const url = new URL(String(fetchMock.mock.calls[0][0]));
        expect(url.pathname).toBe('/optimized-trips/v1/mapbox/driving/126.98,37.55;128,37.56');
        expect(url.searchParams.get('source')).toBe('first');
        expect(url.searchParams.get('roundtrip')).toBe('true');
        expect(result.current.route).toEqual(LINE);
        expect(result.current.minutes).toBe(25);
        expect(result.current.status).toBe('idle');
    });

    it('drops the optimized route when the stops change', async () => {
        optimizer({ code: 'Ok', trips: [{ geometry: LINE, duration: 1500 }] });
        const { result } = renderHook(() => useTripPlanner({ hotel: HOTEL }));
        act(() => result.current.toggle(stop(1)));
        await act(async () => { await result.current.optimize(); });

        act(() => result.current.toggle(stop(1)));

        expect(result.current.stops).toEqual([]);
        expect(result.current.route).toBeNull();
        expect(result.current.minutes).toBeNull();
    });

    it('says when it could not optimize', async () => {
        optimizer({ code: 'NoTrips' });
        const { result } = renderHook(() => useTripPlanner({ hotel: HOTEL }));
        act(() => result.current.toggle(stop(1)));

        await act(async () => { await result.current.optimize(); });

        expect(result.current.status).toBe('failed');
        expect(result.current.route).toBeNull();
    });

    it('does nothing to optimize with no stops', async () => {
        const fetchMock = optimizer({});
        const { result } = renderHook(() => useTripPlanner({ hotel: HOTEL }));
        await act(async () => { await result.current.optimize(); });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/useTripPlanner.test.ts`
Expected: FAIL — cannot resolve the hook.

- [ ] **Step 3: Implement**

`src/features/hotels/hooks/useTripPlanner.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@/shared/lib/env';
import { isAbortError } from '@/shared/lib/error';
import type { NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import { MAX_TRIP_STOPS, type LatLng } from '@/features/hotels/components/nearby/types';

export type TripStatus = 'idle' | 'optimizing' | 'failed' | 'full';

/**
 * A day out from the hotel — v1's itinerary. Up to 11 stops, put in the quickest order by Mapbox's
 * Optimization API as a round trip that starts and ends at the hotel.
 */
export function useTripPlanner({ hotel }: { hotel: LatLng }) {
    const [stops, setStops] = useState<NearbyGem[]>([]);
    const [route, setRoute] = useState<GeoJSON.LineString | null>(null);
    const [minutes, setMinutes] = useState<number | null>(null);
    const [status, setStatus] = useState<TripStatus>('idle');
    const controller = useRef<AbortController | null>(null);
    const hotelLat = hotel.lat;
    const hotelLng = hotel.lng;

    useEffect(() => () => controller.current?.abort(), []);

    const toggle = useCallback((gem: NearbyGem) => {
        const inTrip = stops.some((s) => s.id === gem.id);
        if (!inTrip && stops.length >= MAX_TRIP_STOPS) {
            setStatus('full');
            return;
        }
        controller.current?.abort();
        setStops(inTrip ? stops.filter((s) => s.id !== gem.id) : [...stops, gem]);
        setRoute(null);
        setMinutes(null);
        setStatus('idle');
    }, [stops]);

    const optimize = useCallback(async () => {
        const token = env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (stops.length === 0 || !token) return;
        controller.current?.abort();
        const ctl = new AbortController();
        controller.current = ctl;
        setStatus('optimizing');

        const coords = [{ lat: hotelLat, lng: hotelLng }, ...stops.map((s) => s.coordinates)]
            .map((p) => `${p.lng},${p.lat}`)
            .join(';');
        const qs = new URLSearchParams({ source: 'first', roundtrip: 'true', geometries: 'geojson', overview: 'full', access_token: token });

        try {
            const res = await fetch(`https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}?${qs.toString()}`, { signal: ctl.signal });
            const data = await res.json() as { code?: string; trips?: { geometry: GeoJSON.LineString; duration: number }[] };
            const trip = res.ok && data.code === 'Ok' ? data.trips?.[0] : undefined;
            if (!trip) throw new Error(`optimize: ${data.code ?? res.status}`);
            setRoute(trip.geometry);
            setMinutes(Math.round(trip.duration / 60));
            setStatus('idle');
        } catch (e) {
            if (isAbortError(e)) return;
            setRoute(null);
            setMinutes(null);
            setStatus('failed');
        }
    }, [stops, hotelLat, hotelLng]);

    const clear = useCallback(() => {
        controller.current?.abort();
        setStops([]);
        setRoute(null);
        setMinutes(null);
        setStatus('idle');
    }, []);

    const has = useCallback((id: string) => stops.some((s) => s.id === id), [stops]);

    return { stops, route, minutes, status, full: stops.length >= MAX_TRIP_STOPS, has, toggle, optimize, clear };
}

export type TripPlanner = ReturnType<typeof useTripPlanner>;
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/features/hotels/__tests__/useTripPlanner.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/hotels/hooks/useTripPlanner.ts src/features/hotels/__tests__/useTripPlanner.test.ts
git commit -m "feat(nearby): trip planner with optimized round trip from the hotel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 20: `TripPlannerBar`, wired in

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/components/nearby/TripPlannerBar.tsx`
- Modify: `src/features/hotels/components/nearby/NearbyExplorer.tsx`
- Test: `src/features/hotels/__tests__/TripPlannerBar.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/features/hotels/__tests__/TripPlannerBar.test.tsx`:

```tsx
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { TripPlanner } from '@/features/hotels/hooks/useTripPlanner';
import { TripPlannerBar } from '@/features/hotels/components/nearby/TripPlannerBar';
import { PALETTE, gem, renderWithIntl } from './nearby-fixtures';

function trip(overrides: Partial<TripPlanner> = {}): TripPlanner {
    return {
        stops: [gem(), gem({ id: 'g-2', name: 'Namsan Park' })], route: null, minutes: null, status: 'idle',
        full: false, has: () => true, toggle: vi.fn(), optimize: vi.fn(), clear: vi.fn(), ...overrides,
    } as TripPlanner;
}

describe('TripPlannerBar', () => {
    it('is absent with no stops', () => {
        renderWithIntl(<TripPlannerBar trip={trip({ stops: [] })} palette={PALETTE} />);
        expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });

    it('lists the stops in order with a way to remove each', () => {
        const t = trip();
        renderWithIntl(<TripPlannerBar trip={t} palette={PALETTE} />);
        expect(screen.getByRole('region', { name: 'Your trip · 2/11' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Remove from trip: Namsan Park' }));
        expect(t.toggle).toHaveBeenCalledWith(t.stops[1]);
    });

    it('optimizes and clears', () => {
        const t = trip();
        renderWithIntl(<TripPlannerBar trip={t} palette={PALETTE} />);
        fireEvent.click(screen.getByRole('button', { name: 'Optimize route' }));
        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        expect(t.optimize).toHaveBeenCalled();
        expect(t.clear).toHaveBeenCalled();
    });

    it('shows the round-trip time, a failure, or the stop limit', () => {
        const { unmount } = renderWithIntl(<TripPlannerBar trip={trip({ minutes: 48 })} palette={PALETTE} />);
        expect(screen.getByText('48 min round trip from the hotel')).toBeInTheDocument();
        unmount();

        const second = renderWithIntl(<TripPlannerBar trip={trip({ status: 'failed' })} palette={PALETTE} />);
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't optimize this route.");
        second.unmount();

        renderWithIntl(<TripPlannerBar trip={trip({ status: 'full', full: true })} palette={PALETTE} />);
        expect(screen.getByText('You can plan up to 11 stops.')).toBeInTheDocument();
    });

    it('cannot optimize twice at once', () => {
        renderWithIntl(<TripPlannerBar trip={trip({ status: 'optimizing' })} palette={PALETTE} />);
        expect(screen.getByRole('button', { name: 'Optimizing…' })).toBeDisabled();
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/hotels/__tests__/TripPlannerBar.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Implement**

`src/features/hotels/components/nearby/TripPlannerBar.tsx`:

```tsx
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Route, X } from 'lucide-react';
import type { TripPlanner } from '@/features/hotels/hooks/useTripPlanner';
import { BRAND } from '@/shared/lib/palette';
import { MAX_TRIP_STOPS, type NearbyPalette } from './types';

export function TripPlannerBar({ trip, palette }: { trip: TripPlanner; palette: NearbyPalette }) {
    const t = useTranslations('property.nearby');
    if (trip.stops.length === 0) return null;

    const title = t('trip.title', { count: trip.stops.length, max: MAX_TRIP_STOPS });
    const button: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
        border: `1px solid ${palette.cardBorder}`, background: palette.cardBg, color: palette.title,
        fontSize: 14, fontWeight: 700, cursor: 'pointer',
    };

    return (
        <section aria-label={title} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, background: palette.cardBg, border: `1px solid ${palette.cardBorder}` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: palette.title }}>{title}</div>
            <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                {trip.stops.map((s, i) => (
                    <li key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 10px', borderRadius: 999, background: palette.iconBg, color: palette.text, fontSize: 13 }}>
                        <span>{i + 1}. {s.translatedName ?? s.name}</span>
                        <button
                            type="button"
                            aria-label={`${t('removeFromTrip')}: ${s.name}`}
                            onClick={() => trip.toggle(s)}
                            style={{ display: 'flex', padding: 2, border: 'none', borderRadius: '50%', background: 'transparent', color: palette.muted, cursor: 'pointer' }}
                        >
                            <X size={12} aria-hidden />
                        </button>
                    </li>
                ))}
            </ol>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={() => trip.optimize()}
                    disabled={trip.status === 'optimizing'}
                    style={{ ...button, border: `1px solid ${BRAND.primaryStrong}`, background: BRAND.primaryStrong, color: '#fff', opacity: trip.status === 'optimizing' ? 0.7 : 1 }}
                >
                    <Route size={15} aria-hidden />
                    {trip.status === 'optimizing' ? t('trip.optimizing') : t('trip.optimize')}
                </button>
                <button type="button" onClick={trip.clear} style={button}>{t('trip.clear')}</button>
            </div>
            {trip.minutes !== null && <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: palette.title }}>{t('trip.summary', { minutes: trip.minutes })}</p>}
            {trip.status === 'failed' && <p role="alert" style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{t('trip.failed')}</p>}
            {trip.status === 'full' && <p role="status" style={{ margin: 0, fontSize: 13, color: palette.muted }}>{t('trip.max', { max: MAX_TRIP_STOPS })}</p>}
        </section>
    );
}
```

- [ ] **Step 4: Wire it into `NearbyExplorer`**

Add imports:

```ts
import { useTripPlanner } from '@/features/hotels/hooks/useTripPlanner';
import { TripPlannerBar } from './TripPlannerBar';
```

Replace:

```ts
    const route = originActive ? originRoute.route : placeRoute.route;
```

with:

```ts
    const trip = useTripPlanner({ hotel: coordinates });
    // An optimized trip outranks both single routes until its stops change (v1's order).
    const route = trip.route ?? (originActive ? originRoute.route : placeRoute.route);

    const tripRoute = trip.route;
    const tripStops = trip.stops;
    useEffect(() => {
        if (!tripRoute) return;
        fitToPoints(mapRef.current, [{ lat: coordinates.lat, lng: coordinates.lng }, ...tripStops.map((s) => s.coordinates)]);
    }, [tripRoute, tripStops, coordinates.lat, coordinates.lng]);
```

In the `<PlaceCallout …>` props, add:

```tsx
                        trip={{ inTrip: trip.has(active.id), full: trip.full, onToggle: () => trip.toggle(active) }}
```

Directly after `<DirectionsPanel … />`, add:

```tsx
            <TripPlannerBar trip={trip} palette={palette} />
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/features/hotels/__tests__
npm run type-check
```

Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/hotels/components/nearby/TripPlannerBar.tsx src/features/hotels/components/nearby/NearbyExplorer.tsx src/features/hotels/__tests__/TripPlannerBar.test.tsx
git commit -m "feat(nearby): plan and optimize a trip from the place callout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Browser check** — select three places, "Add to trip" on each, "Optimize route", screenshot. Expected: one loop line through all three from the hotel, the map fitted to them, "N min round trip from the hotel".

---

# Slice 6 — Weather, map controls, fullscreen, cleanup

## Task 21: `useWeather` + `WeatherChip`

**Repo:** app-v2
**Files:**
- Create: `src/features/hotels/hooks/useWeather.ts`
- Create: `src/features/hotels/components/nearby/WeatherChip.tsx`
- Test: `src/features/hotels/__tests__/weather.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/features/hotels/__tests__/weather.test.tsx`:

```tsx
import { renderHook, waitFor, act, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/shared/lib/env', () => ({ env: { NEXT_PUBLIC_API_URL: 'http://api.test/api/v2', NEXT_PUBLIC_MAPBOX_TOKEN: 'pk.test' } }));

import { useWeather, type WeatherReport } from '@/features/hotels/hooks/useWeather';
import { WeatherChip } from '@/features/hotels/components/nearby/WeatherChip';
import { HOTEL, PALETTE, renderWithIntl } from './nearby-fixtures';

const REPORT: WeatherReport = {
    current: { temp: 22, feelsLike: 24, description: 'Partly cloudy', iconUrl: 'https://example.test/icon.png' },
    daily: [
        { date: '2026-10-08', tempMax: 25, tempMin: 18, iconUrl: '', description: 'Sunny' },
        { date: '2026-10-09', tempMax: 23, tempMin: 17, iconUrl: '', description: 'Cloudy' },
    ],
    units: { temp: '°C' },
};

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('useWeather', () => {
    it('loads the weather at the hotel', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(REPORT)));
        vi.stubGlobal('fetch', fetchMock);

        const { result } = renderHook(() => useWeather(HOTEL));

        await waitFor(() => expect(result.current).toEqual(REPORT));
        expect(String(fetchMock.mock.calls[0][0])).toBe('http://api.test/api/v2/weather?lat=37.55&lng=126.98');
    });

    it('gives nothing when the weather fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })));
        const { result } = renderHook(() => useWeather(HOTEL));
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        expect(result.current).toBeNull();
    });

    it('refreshes every 15 minutes', async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn(async () => new Response(JSON.stringify(REPORT)));
        vi.stubGlobal('fetch', fetchMock);

        renderHook(() => useWeather(HOTEL));
        await act(async () => { await vi.advanceTimersByTimeAsync(15 * 60 * 1000); });

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});

describe('WeatherChip', () => {
    it('shows the temperature, conditions and what it feels like', () => {
        renderWithIntl(<WeatherChip report={REPORT} palette={PALETTE} />);
        expect(screen.getByText('22°C')).toBeInTheDocument();
        expect(screen.getByText(/Partly cloudy/)).toBeInTheDocument();
        expect(screen.getByText(/Feels like 24°C/)).toBeInTheDocument();
        expect(screen.getByText('25° / 18°')).toBeInTheDocument();
    });

    it('draws nothing without a report', () => {
        const { container } = renderWithIntl(<WeatherChip report={null} palette={PALETTE} />);
        expect(container).toBeEmptyDOMElement();
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/weather.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement `useWeather`**

`src/features/hotels/hooks/useWeather.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { env } from '@/shared/lib/env';
import { isAbortError } from '@/shared/lib/error';
import type { LatLng } from '@/features/hotels/components/nearby/types';

/** The parts of api-v2's /weather response the chip draws. */
export interface WeatherReport {
    current: { temp: number; feelsLike: number; description: string; iconUrl: string };
    daily: { date: string; tempMax: number; tempMin: number; iconUrl: string; description: string }[];
    units: { temp: string };
}

const REFRESH_MS = 15 * 60 * 1000;

/** Weather at the hotel, refreshed every 15 minutes as v1 did. `null` when there is none to show. */
export function useWeather(coordinates: LatLng | null): WeatherReport | null {
    const [report, setReport] = useState<WeatherReport | null>(null);
    const lat = coordinates?.lat;
    const lng = coordinates?.lng;

    useEffect(() => {
        if (lat === undefined || lng === undefined) return;
        const controller = new AbortController();

        const load = async () => {
            try {
                const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/weather?lat=${lat}&lng=${lng}`, { signal: controller.signal });
                if (!res.ok) throw new Error(`weather ${res.status}`);
                setReport(await res.json() as WeatherReport);
            } catch (e) {
                if (!isAbortError(e)) setReport(null);
            }
        };

        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => {
            controller.abort();
            clearInterval(timer);
        };
    }, [lat, lng]);

    return report;
}
```

- [ ] **Step 4: Implement `WeatherChip`**

`src/features/hotels/components/nearby/WeatherChip.tsx`:

```tsx
'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { WeatherReport } from '@/features/hotels/hooks/useWeather';
import type { NearbyPalette } from './types';

/** Current weather and the next three days, in a corner of the map. Hidden when there is none. */
export function WeatherChip({ report, palette }: { report: WeatherReport | null; palette: NearbyPalette }) {
    const t = useTranslations('property.nearby');
    const locale = useLocale();
    if (!report) return null;

    const { current, daily, units } = report;
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });

    return (
        <div
            style={{
                position: 'absolute', left: 12, bottom: 12, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', borderRadius: 12, background: palette.bg, color: palette.text,
                border: `1px solid ${palette.cardBorder}`, boxShadow: '0 4px 14px rgba(0,0,0,.2)',
            }}
        >
            {current.iconUrl && <img src={current.iconUrl} alt="" width={32} height={32} />}
            <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: palette.title, lineHeight: 1.1 }}>{current.temp}{units.temp}</div>
                <div style={{ fontSize: 12, color: palette.muted }}>
                    {current.description} · {t('weather.feelsLike', { temp: `${current.feelsLike}${units.temp}` })}
                </div>
            </div>
            {daily.length > 0 && (
                <ul style={{ display: 'flex', gap: 10, margin: 0, padding: '0 0 0 12px', listStyle: 'none', borderLeft: `1px solid ${palette.hairline}` }}>
                    {daily.slice(0, 3).map((d) => (
                        <li key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 11, color: palette.muted }}>
                            <span style={{ fontWeight: 700, color: palette.soft }}>{weekday.format(new Date(`${d.date}T00:00:00Z`))}</span>
                            <span>{t('weather.highLow', { high: `${d.tempMax}°`, low: `${d.tempMin}°` })}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx vitest run src/features/hotels/__tests__/weather.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/hotels/hooks/useWeather.ts src/features/hotels/components/nearby/WeatherChip.tsx src/features/hotels/__tests__/weather.test.tsx
git commit -m "feat(nearby): weather at the hotel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 22: Map controls, fullscreen, weather in the explorer (final explorer)

**Repo:** app-v2
**Files:**
- Modify (full replacement): `src/features/hotels/components/nearby/NearbyExplorer.tsx`
- Test: extend `src/features/hotels/__tests__/NearbyExplorer.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `NearbyExplorer.test.tsx`, add next to the other mocks:

```tsx
vi.mock('@/features/hotels/hooks/useWeather', () => ({ useWeather: () => null }));
```

and inside the `describe`:

```tsx
    it('goes fullscreen and comes back with Escape', () => {
        explorer();
        fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));

        expect(document.body.style.overflow).toBe('hidden');
        expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(document.body.style.overflow).toBe('');
        expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();
    });

    it('Escape closes the details popup before it leaves fullscreen', () => {
        explorer();
        fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
        fireEvent.click(screen.getByRole('button', { name: 'Details' }));

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
    });

    it('opens the map layers panel', () => {
        explorer();
        expect(screen.queryByText('Map Details')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
        expect(screen.getByText('Map Details')).toBeInTheDocument();
    });
```

(`Map Details` is `MapDetailsPanel`'s heading, `map.details` in en.json.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/hotels/__tests__/NearbyExplorer.test.tsx`
Expected: FAIL — no Fullscreen / Layers buttons.

- [ ] **Step 3: Replace `NearbyExplorer.tsx` with its final form**

```tsx
'use client';

/**
 * Nearby places on the property page — v1's property map, rebuilt
 * (docs/superpowers/specs/2026-10-08-nearby-places-v1-parity-design.md).
 *
 * Owns the section's state and hands each piece only the slice it draws. Fullscreen renders the
 * same tree through a portal rather than keeping a second copy of it, as v1 did.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Layers, LocateFixed, Maximize, Minimize } from 'lucide-react';
import type { MapRef } from 'react-map-gl/mapbox';
import type { PoiCategory } from '@/shared/config/map-discovery';
import { useNearbyGems, type NearbyGem } from '@/features/hotels/hooks/useNearbyGems';
import { useOriginSearch } from '@/features/hotels/hooks/useOriginSearch';
import { useTripPlanner } from '@/features/hotels/hooks/useTripPlanner';
import { useWeather } from '@/features/hotels/hooks/useWeather';
import { useDistanceUnit } from '@/shared/hooks/useDistanceUnit';
import { useMapboxDirections, type DirectionsProfile } from '@/shared/components/mapbox/hooks/useMapboxDirections';
import { useMapDetails } from '@/shared/components/mapbox/hooks/useMapDetails';
import { MapDetailsPanel } from '@/shared/components/mapbox/components/MapDetailsPanel';
import { nearestRadius } from '@/shared/lib/distance';
import { NearbyMap } from './NearbyMap';
import { PlaceStrip } from './PlaceStrip';
import { PlaceDetailsModal } from './PlaceDetailsModal';
import { PlaceCallout } from './PlaceCallout';
import { DirectionsPanel } from './DirectionsPanel';
import { TripPlannerBar } from './TripPlannerBar';
import { WeatherChip } from './WeatherChip';
import { fitToPoints } from './map-bounds';
import type { LatLng, NearbyPalette } from './types';

interface NearbyExplorerProps {
    coordinates: LatLng;
    hotelName: string;
    palette: NearbyPalette;
}

const MAP_HEIGHT = 420;

export function NearbyExplorer({ coordinates, hotelName, palette }: NearbyExplorerProps) {
    const t = useTranslations('property.nearby');
    const tOverlay = useTranslations('property.mapOverlay');
    const mapRef = useRef<MapRef>(null);
    const [unit, setUnit] = useDistanceUnit();
    const [category, setCategory] = useState<PoiCategory>('all');
    const [radius, setRadius] = useState(2000);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [detailsId, setDetailsId] = useState<string | null>(null);
    const [profile, setProfile] = useState<DirectionsProfile>('driving-traffic');
    const [directionsOpen, setDirectionsOpen] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);

    // The radius picker offers round steps in the viewer's unit; keep the selection on one of
    // them when the unit flips (or when the browser's guess lands after hydration).
    useEffect(() => { setRadius((r) => nearestRadius(r, unit)); }, [unit]);

    const { gems, loading, error, retry } = useNearbyGems({ coordinates, category, radiusMeters: radius });
    const active = gems.find((g) => g.id === activeId) ?? null;
    const detailsGem = gems.find((g) => g.id === detailsId) ?? null;

    const origin = useOriginSearch({ hotel: coordinates });
    // While a where-from route is showing, it replaces the place route (v1 behaviour).
    const originActive = directionsOpen && origin.origin !== null;
    const originRoute = useMapboxDirections({ origin: origin.origin, destination: coordinates, profile, enabled: originActive });
    const placeRoute = useMapboxDirections({
        origin: coordinates,
        destination: active?.coordinates ?? null,
        profile,
        enabled: active !== null && !originActive,
    });

    const trip = useTripPlanner({ hotel: coordinates });
    // An optimized trip outranks both single routes until its stops change (v1's order).
    const route = trip.route ?? (originActive ? originRoute.route : placeRoute.route);

    const weather = useWeather(coordinates);
    const {
        mapType, setMapType, showDetailsPanel, setShowDetailsPanel, showLabels, setShowLabels,
        mapDetails, handleDetailToggle, mapStyleUrl, standardConfig,
    } = useMapDetails('default');
    // "Default" is the property page's own themed style; the panel's other choices replace it.
    const mapStyle = mapType === 'default' ? palette.mapStyle : mapStyleUrl;

    const originLat = origin.origin?.lat;
    const originLng = origin.origin?.lng;
    useEffect(() => {
        if (!originActive || originLat === undefined || originLng === undefined) return;
        fitToPoints(mapRef.current, [{ lat: originLat, lng: originLng }, { lat: coordinates.lat, lng: coordinates.lng }]);
    }, [originActive, originLat, originLng, coordinates.lat, coordinates.lng]);

    const tripRoute = trip.route;
    const tripStops = trip.stops;
    useEffect(() => {
        if (!tripRoute) return;
        fitToPoints(mapRef.current, [{ lat: coordinates.lat, lng: coordinates.lng }, ...tripStops.map((s) => s.coordinates)]);
    }, [tripRoute, tripStops, coordinates.lat, coordinates.lng]);

    useEffect(() => {
        if (!fullscreen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // The details popup takes Escape first; only a bare Escape leaves fullscreen.
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !detailsId) setFullscreen(false); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener('keydown', onKey);
        };
    }, [fullscreen, detailsId]);

    const select = useCallback((gem: NearbyGem) => {
        if (gem.id === activeId) {
            setActiveId(null);
            return;
        }
        setActiveId(gem.id);
        mapRef.current?.flyTo({ center: [gem.coordinates.lng, gem.coordinates.lat], zoom: 16, duration: 800 });
    }, [activeId]);

    const changeCategory = useCallback((next: PoiCategory) => {
        setCategory(next);
        setActiveId(null);
    }, []);

    const { clear: clearOrigin } = origin;
    const changeDirectionsOpen = useCallback((open: boolean) => {
        setDirectionsOpen(open);
        if (!open) clearOrigin();
    }, [clearOrigin]);

    const recenter = useCallback(() => {
        mapRef.current?.flyTo({ center: [coordinates.lng, coordinates.lat], zoom: 14, duration: 800 });
    }, [coordinates.lat, coordinates.lng]);

    const showDetails = useCallback((gem: NearbyGem) => setDetailsId(gem.id), []);
    const closeDetails = useCallback(() => setDetailsId(null), []);

    const control: React.CSSProperties = {
        width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: palette.bg, color: palette.title, border: `1px solid ${palette.cardBorder}`,
        boxShadow: '0 4px 12px rgba(0,0,0,.2)', cursor: 'pointer',
    };

    const content = (
        <div
            style={fullscreen
                ? { position: 'fixed', inset: 0, zIndex: 10000, background: palette.bg, display: 'flex', flexDirection: 'column', gap: 12, padding: 16, overflowY: 'auto' }
                : { display: 'flex', flexDirection: 'column', gap: 14 }}
        >
            <NearbyMap
                mapRef={mapRef}
                hotel={coordinates}
                hotelLabel={hotelName || t('hotel')}
                places={gems}
                activeId={active?.id ?? null}
                onSelect={select}
                mapStyle={mapStyle}
                standardConfig={mapType === 'default-3d' ? standardConfig : undefined}
                route={route}
                origin={originActive ? origin.origin : null}
                height={fullscreen ? '70vh' : MAP_HEIGHT}
            >
                {active && !originActive && (
                    <PlaceCallout
                        gem={active}
                        hotel={coordinates}
                        unit={unit}
                        directions={placeRoute}
                        profile={profile}
                        onProfileChange={setProfile}
                        onDetails={showDetails}
                        onClose={() => setActiveId(null)}
                        trip={{ inTrip: trip.has(active.id), full: trip.full, onToggle: () => trip.toggle(active) }}
                        palette={palette}
                    />
                )}
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                        type="button"
                        aria-label={fullscreen ? tOverlay('exitFullscreen') : tOverlay('fullscreen')}
                        title={fullscreen ? tOverlay('exitFullscreen') : tOverlay('fullscreen')}
                        onClick={() => setFullscreen((f) => !f)}
                        style={control}
                    >
                        {fullscreen ? <Minimize size={17} aria-hidden /> : <Maximize size={17} aria-hidden />}
                    </button>
                    <button type="button" aria-label={tOverlay('recenterMap')} title={tOverlay('recenterMap')} onClick={recenter} style={control}>
                        <LocateFixed size={17} aria-hidden />
                    </button>
                    <button type="button" aria-label={tOverlay('layers')} title={tOverlay('layers')} onClick={() => setShowDetailsPanel(!showDetailsPanel)} style={control}>
                        <Layers size={17} aria-hidden />
                    </button>
                </div>
                <MapDetailsPanel
                    isOpen={showDetailsPanel}
                    onClose={() => setShowDetailsPanel(false)}
                    mapType={mapType}
                    onMapTypeChange={setMapType}
                    details={mapDetails}
                    onDetailToggle={handleDetailToggle}
                    showLabels={showLabels}
                    onLabelsToggle={() => setShowLabels((prev) => !prev)}
                />
                <WeatherChip report={weather} palette={palette} />
            </NearbyMap>
            <DirectionsPanel
                open={directionsOpen}
                onOpenChange={changeDirectionsOpen}
                search={origin}
                profile={profile}
                onProfileChange={setProfile}
                directions={originRoute}
                palette={palette}
            />
            <TripPlannerBar trip={trip} palette={palette} />
            <PlaceStrip
                gems={gems}
                loading={loading}
                error={error}
                onRetry={retry}
                category={category}
                onCategoryChange={changeCategory}
                radius={radius}
                onRadiusChange={setRadius}
                unit={unit}
                onUnitChange={setUnit}
                hotel={coordinates}
                activeId={active?.id ?? null}
                onSelect={select}
                onDetails={showDetails}
                palette={palette}
            />
        </div>
    );

    return (
        <>
            {fullscreen ? createPortal(content, document.body) : content}
            <PlaceDetailsModal gem={detailsGem} hotel={coordinates} unit={unit} palette={palette} onClose={closeDetails} />
        </>
    );
}
```

Check before running: `useMapDetails` returns `setShowLabels` as a React state setter (it does — `const [showLabels, setShowLabels] = useState(true)` returned as is), so `setShowLabels((prev) => !prev)` type-checks.

- [ ] **Step 4: Run tests, type-check, lint**

```bash
npx vitest run src/features/hotels/__tests__
npm run type-check
npm run lint
```

Expected: PASS; no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/hotels/components/nearby/NearbyExplorer.tsx src/features/hotels/__tests__/NearbyExplorer.test.tsx
git commit -m "feat(nearby): fullscreen, recenter, map layers and weather on the nearby map

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 23: Remove dead files, update CONTEXT.md

**Repo:** app-v2
**Files:**
- Delete: `src/features/hotels/components/poi-discovery.tsx`, `src/features/hotels/components/nearby-section.tsx`
- Modify: `CONTEXT.md`

- [ ] **Step 1: Confirm nothing imports them**

```bash
grep -rn "poi-discovery\|nearby-section\|PoiDiscovery\|NearbySection" src
```

Expected: no output.

- [ ] **Step 2: Delete and update the context doc**

```bash
git rm src/features/hotels/components/poi-discovery.tsx src/features/hotels/components/nearby-section.tsx
```

In `CONTEXT.md`, replace:

```
- POI discovery on property page (Google Places)
```

with:

```
- POI discovery on property page (Google Places)
- Nearby places at v1 parity on property page — routes, details popup, directions to the hotel, trip planner, weather, fullscreen; km/miles as a viewer preference (spec 2026-10-08)
```

and delete this line from the *Deferred — not in Phase 1* list:

```
- Weather widget on property page
```

- [ ] **Step 3: Full suite, type-check, lint**

```bash
npx vitest run
npm run type-check
npm run lint
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add CONTEXT.md
git commit -m "chore(nearby): drop unused nearby components; weather is no longer deferred

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 24: Final verification

- [ ] **Step 1: Both repos green**

```bash
# api-v2 worktree
npx vitest run && npm run type-check && npm run lint
# app-v2 worktree
npx vitest run && npm run type-check && npm run lint
```

Expected: everything passes. Record the test counts.

- [ ] **Step 2: End-to-end in the browser, light and dark**

Extend `qa-nearby.mjs` into one pass per theme that screenshots: strip with photos → a selected place with route and three times → details popup → directions from "Seoul Station" → a three-stop optimized trip → weather chip visible → fullscreen → Escape back → km/mi flipped. Also run once with `locale: 'ko-KR'` on `/ko/…` to confirm km by default and Korean strings. Look at every screenshot; fix anything off with a failing test first.

- [ ] **Step 3: Hand off**

Use superpowers:finishing-a-development-branch for both worktrees.

---

## Known issue to raise, not fix here

api-v2's `/weather` answers **any** upstream failure with mock data ("Partly Cloudy (Mock)", 22°C), so the chip can show invented weather as real. The spec keeps that route unchanged; flag it to the user at the end so they can decide whether to make it return an error the chip can hide on.
