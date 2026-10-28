# Hotel booking — Phase 1: provider layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a `HotelProvider` seam under the existing hotel booking flow, add a deterministic `MockHotelProvider`, and route search / rates / prebook / book / cancel through the seam with **no change to any request or response shape**.

**Architecture:** A provider contract in `src/lib/hotels/providers/` (typed errors, neutral booking types). `TravelgateXProvider` adapts the existing `runTgxSearch` / `quoteTgx` / `bookTgx` / `cancelTgx` unchanged. `MockHotelProvider` is in-process and deterministic. `HotelsService` and the search-stream controller call `getHotelProvider()`. One shared contract suite runs against both providers.

**Tech Stack:** TypeScript (strict), Express, Vitest, zod (config). No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-14-hotel-booking-flow-design.md` (§3.1–3.3, §5).

**Repo:** all paths are in `cheapestgo-api-v2` (the `-nearby` worktree), branch `feat/hotel-booking-flow`.

---

## Conventions for every task

PowerShell, from any directory (no `cd`):

```powershell
$api = 'c:\Users\USER\Documents\GitHub\cheapestgo-api-v2-nearby'

# one test file
npm --prefix $api run test -- src/__tests__/<file>.test.ts

# whole suite
npm --prefix $api run test

# type-check (declaration off: the repo's pnpm-style node_modules makes declaration emit
# report 26 unrelated TS2742 errors; with it off the baseline is exit 0)
& "$api\node_modules\.bin\tsc.cmd" -p "$api\tsconfig.json" --noEmit --declaration false

# lint (baseline: 3 errors in cityAliases.ts / destinations.service.ts, 25 warnings)
npm --prefix $api run lint
```

Commits use the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

**Baseline to preserve:** 66 test files / 834 tests green; `tsc` exit 0; lint 3 errors.

## Behaviour changes this phase makes on purpose

Everything else is a pure refactor and is pinned by the existing suites.

| # | Change | Why |
|---|---|---|
| 1 | The stream no longer divides listing prices by nights a second time; ETG-sourced listings are divided once at the provider | `buildCityResults` (2026-10-05) and `searchStream` (2026-09-25) both divide, so TGX cards advertise `total / nights²`. ADR-0020: divide once. |
| 2 | A supplier timeout / outage in prebook's fresh search is a typed 503/502, not a bare 500 | Typed codes the UI can map |
| 3 | `book` retries with a fresh option only when the failure is a vanished option, not on any text containing "unavailable" | A 503 body containing "unavailable" must not trigger a second booking after an ambiguous failure |
| 4 | Supplier-failure responses from `confirm` always carry `providerConfirmed: false` | Was present on one branch only |
| 5 | Cancel routes by the booking's own `provider` column | A booking made on one supplier must not be cancelled through another |
| 6 | `HOTEL_PROVIDER=mock` is refused in production; mock mode logs email instead of sending it | A mock reservation must never charge a real card or mail a real address |

---

## File structure

```
src/lib/hotels/providers/
  types.ts                  contract: HotelProvider, neutral booking types, HotelProviderError
  cancellationPolicy.ts     terms -> the legacy wire shapes the checkout and snapshot read
  travelgatex.provider.ts   TravelgateXProvider (adapter over lib/hotels/search + travelgatex)
  factory.ts                resolveProviderId / getHotelProvider / getHotelProviderById
  mock/
    scenarios.ts            the nine scenario names
    catalog.ts              24 Philippine properties, room types, rate plans
    pricing.ts              pure price function and date helpers
    MockHotelProvider.ts    the provider
src/services/hotelProviderErrors.ts   HotelProviderError -> AppError
```

Modified: `src/config.ts`, `.env.example`, `src/services/hotels.service.ts`,
`src/controllers/hotels.controller.ts`, `src/lib/email/send.ts`.

Tests: `src/__tests__/hotelProvider.{types,cancellationPolicy,mock,travelgatex,factory,contract}.test.ts`,
`config.hotelProvider.test.ts`, `hotels.service.mockProvider.test.ts`, `hotels.searchStream.test.ts`,
`email.transport.test.ts`.

---

### Task 1: Contract types and `HotelProviderError`

**Files:**
- Create: `src/lib/hotels/providers/types.ts`
- Test: `src/__tests__/hotelProvider.types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/hotelProvider.types.test.ts
import { describe, it, expect } from 'vitest';
import { HotelProviderError, isHotelProviderError } from '@/lib/hotels/providers/types';
import type { HotelProviderErrorCode } from '@/lib/hotels/providers/types';

const CODES: HotelProviderErrorCode[] = [
    'INVALID_RATE', 'SOLD_OUT', 'PRICE_CHANGED', 'NOT_PAYABLE_ONLINE',
    'REJECTED', 'TIMEOUT', 'UNKNOWN_OUTCOME', 'UNAVAILABLE',
];

describe('HotelProviderError', () => {
    it('carries a code the caller branches on and a message a person can read', () => {
        const err = new HotelProviderError('SOLD_OUT', 'Room is gone', { provider: 'mock' });
        expect(err.code).toBe('SOLD_OUT');
        expect(err.message).toBe('Room is gone');
        expect(err.details.provider).toBe('mock');
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('HotelProviderError');
    });

    it.each(CODES)('flags only UNKNOWN_OUTCOME as a mutation that may have landed (%s)', (code) => {
        expect(new HotelProviderError(code, 'x').mutationMayHaveLanded).toBe(code === 'UNKNOWN_OUTCOME');
    });

    it('is recognised by isHotelProviderError, and a plain Error is not', () => {
        expect(isHotelProviderError(new HotelProviderError('REJECTED', 'no'))).toBe(true);
        expect(isHotelProviderError(new Error('no'))).toBe(false);
        expect(isHotelProviderError(undefined)).toBe(false);
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.types.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/hotels/providers/types"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/hotels/providers/types.ts
/**
 * The contract between the booking flow and a hotel supplier.
 *
 * Everything above `src/lib/hotels/providers/` speaks these types and nothing else. A supplier's
 * vocabulary — TravelgateX option tokens, ETG hashes, whatever the next one calls a rate — stops
 * at its adapter, which is what makes "add a provider" one class and one line in the factory
 * rather than an edit to the booking flow (ADR-0025).
 *
 * Search and rate results deliberately keep the existing listing shapes from `@/types/hotels`:
 * they were already supplier-neutral, they are the wire format the web and mobile clients read,
 * and changing them is a contract decision, not a refactor.
 */

import type { HotelSearchParams, HotelSearchResult, RoomType } from '@/types/hotels';

export type { HotelSearchParams, HotelSearchResult, RoomType };

export type ProviderId = 'travelgatex' | 'mock';

/** What a supplier can do beyond the core flow. Callers branch on these, never on the id. */
export interface ProviderCapabilities {
    /** Can read a reservation back from the supplier. TravelgateX cannot (ADR-0026). */
    bookingRead: boolean;
    /**
     * The provider is the authority on hotel content and on which hotels exist. When true the
     * database catalog and ETG enrichment are skipped: mixing a mock's hotels with real catalog
     * rows would show properties it can never price.
     */
    providesContent: boolean;
}

/** The price of the whole stay, as a supplier quotes it. */
export type StayTotal = number;
/** A stay total divided by its nights — what a search card advertises (ADR-0020). */
export type NightlyRate = number;

export interface StayQuery {
    /** YYYY-MM-DD */
    checkIn:      string;
    /** YYYY-MM-DD */
    checkOut:     string;
    adults:       number;
    children:     number;
    /** The currency to quote in, where the supplier can convert. */
    currency?:    string;
    /** ISO 3166 alpha-2 of the guest; suppliers use it to choose rates. */
    nationality?: string;
}

export interface SupplierPrice {
    net:      StayTotal;
    gross:    StayTotal;
    currency: string;
}

export interface Surcharge {
    chargeType: string;
    mandatory:  boolean;
    price:      SupplierPrice;
}

export interface QuotedRoom {
    code:           string;
    description:    string;
    occupancyRefId: number;
}

export interface CancellationPenalty {
    /** The penalty applies from this instant (ISO-8601). */
    deadline:     string;
    /** The supplier's own penalty kind, passed through ('AMOUNT', 'PERCENT', 'Importe', …). */
    type:         string;
    value:        number;
    currency:     string;
    hoursBefore?: number;
}

export interface CancellationTerms {
    refundable: boolean;
    penalties:  CancellationPenalty[];
}

export interface HotelContent {
    hotelId:      string;
    name:         string;
    address:      string;
    city:         string;
    country:      string;
    lat:          number;
    lng:          number;
    starRating:   number;
    description:  string;
    images:       string[];
    amenities:    string[];
    checkInTime:  string | null;
    checkOutTime: string | null;
}

export interface PrebookInput {
    /** An offer id taken from a listing or a rate. Opaque. */
    offerId:   string;
    /** The room the traveller picked, so the same one is preferred when rates are re-read. */
    roomName?: string;
    adults:    number;
    children:  number;
    currency:  string;
}

export interface PrebookResult {
    /** What `book` takes. Opaque, and only valid for this provider. */
    prebookRef:      string;
    checkIn:         string;
    checkOut:        string;
    /** The room actually quoted, which may not be the one asked for. */
    roomName:        string;
    roomSubstituted: boolean;
    price:           SupplierPrice;
    surcharges:      Surcharge[];
    cancellation:    CancellationTerms | null;
    boardCode:       string;
    rooms:           QuotedRoom[];
}

export interface BookGuest {
    firstName: string;
    lastName:  string;
    age:       number;
    type:      'adult' | 'child';
}

export interface BookInput {
    prebookRef: string;
    /** Our reference. The supplier files the reservation under it, and a cancel quotes it. */
    clientRef:  string;
    holder:     { firstName: string; lastName: string; email: string };
    guests:     BookGuest[];
    /** Needed by a supplier that must re-quote when its option has expired. */
    stay:       { adults: number; children: number; currency: string };
}

export interface ProviderBooking {
    provider:      ProviderId;
    /** The supplier's own status word. */
    status:        string;
    clientRef?:    string;
    supplierRef?:  string;
    hotelRef?:     string;
    hotelCode?:    string;
    hotelName?:    string;
    price?:        { net?: number; gross?: number; currency?: string };
    cancellation?: CancellationTerms | null;
}

export interface ProviderBookingRef {
    clientRef?:   string;
    supplierRef?: string;
}

export interface CancelInput {
    clientRef?:   string;
    supplierRef?: string;
    hotelCode?:   string;
}

export interface ProviderCancellation {
    /** Always 'CANCELLED' on success; a failure is an error, not a status. */
    status:        'CANCELLED';
    supplierRef?:  string;
    clientRef?:    string;
    refundAmount?: number;
    currency?:     string;
}

export interface HotelProvider {
    readonly id:           ProviderId;
    /** For messages shown to people, e.g. "no reference returned from TravelgateX". */
    readonly displayName:  string;
    readonly capabilities: ProviderCapabilities;

    /** Is this offer or prebook reference one of this provider's? */
    ownsRef(ref: string): boolean;

    /** Listings priced per night (NightlyRate), one per hotel. */
    searchHotels(q: HotelSearchParams): Promise<HotelSearchResult>;
    /** Null when the provider holds no content of its own (the catalog tables do). */
    getHotelDetails(hotelId: string): Promise<HotelContent | null>;
    /** Flat rate options for one hotel, priced as a StayTotal. */
    getRates(hotelId: string, stay: StayQuery): Promise<RoomType[]>;
    /** Re-checks availability and price. Throws SOLD_OUT / PRICE_CHANGED / … */
    prebook(input: PrebookInput): Promise<PrebookResult>;
    /** Throws REJECTED / SOLD_OUT / UNKNOWN_OUTCOME / … — never returns a failed booking. */
    book(input: BookInput): Promise<ProviderBooking>;
    /** Present only when `capabilities.bookingRead`. */
    getBooking?(ref: ProviderBookingRef): Promise<ProviderBooking | null>;
    cancelBooking(input: CancelInput): Promise<ProviderCancellation>;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Why a supplier call failed, in the terms the booking flow decides on.
 *
 * The distinction that matters most is between a failure that is *definitive* — the supplier
 * said no, nothing was booked, release the money — and one that is *ambiguous* — the request may
 * have landed. Treating the second like the first is how a guest ends up holding a room we
 * refunded them for (ADR-0026, ADR-0013).
 */
export type HotelProviderErrorCode =
    /** The reference is not this provider's, or cannot be decoded. */
    | 'INVALID_RATE'
    /** The room or rate is gone. Definitive. */
    | 'SOLD_OUT'
    /** Re-priced beyond what was shown. Definitive; carries the new figure. */
    | 'PRICE_CHANGED'
    /** The supplier collects payment itself, so we cannot take it. Definitive. */
    | 'NOT_PAYABLE_ONLINE'
    /** The supplier refused. Definitive. */
    | 'REJECTED'
    /** A read or quote got no answer in time. Nothing changed; safe to retry. */
    | 'TIMEOUT'
    /** A booking or cancellation may have reached the supplier. Never void on this alone. */
    | 'UNKNOWN_OUTCOME'
    /** Transport or configuration failure before anything could have landed. */
    | 'UNAVAILABLE';

export interface HotelProviderErrorDetails {
    provider?:      ProviderId;
    previousTotal?: number;
    currentTotal?:  number;
    currency?:      string;
    cause?:         unknown;
}

export class HotelProviderError extends Error {
    constructor(
        public readonly code: HotelProviderErrorCode,
        message: string,
        public readonly details: HotelProviderErrorDetails = {},
    ) {
        super(message);
        this.name = 'HotelProviderError';
    }

    /** True when the supplier may have acted on the request. */
    get mutationMayHaveLanded(): boolean {
        return this.code === 'UNKNOWN_OUTCOME';
    }
}

export function isHotelProviderError(err: unknown): err is HotelProviderError {
    return err instanceof HotelProviderError;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.types.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```powershell
git -C $api add src/lib/hotels/providers/types.ts src/__tests__/hotelProvider.types.test.ts
git -C $api commit -m @'
feat(hotels): provider contract and typed provider errors

The seam the booking flow will speak to a supplier through. Errors separate
definitive failures (release the money) from ambiguous ones (the request may
have landed).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 2: Cancellation terms → legacy wire shapes

**Files:**
- Create: `src/lib/hotels/providers/cancellationPolicy.ts`
- Test: `src/__tests__/hotelProvider.cancellationPolicy.test.ts`

These two functions are the old `normalizeTgxCancelPolicy` and the policy block inside
`confirmBooking`, lifted out so the wire does not move.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/hotelProvider.cancellationPolicy.test.ts
import { describe, it, expect } from 'vitest';
import { toPrebookPolicyWire, toStoredPolicyWire } from '@/lib/hotels/providers/cancellationPolicy';
import type { CancellationTerms } from '@/lib/hotels/providers/types';

const REFUNDABLE: CancellationTerms = {
    refundable: true,
    penalties: [
        { deadline: '2026-11-07T10:00:00.000Z', type: 'AMOUNT',  value: 120, currency: 'USD', hoursBefore: 72 },
        { deadline: '2026-11-09T10:00:00.000Z', type: 'PERCENT', value: 100, currency: '',    hoursBefore: 24 },
    ],
};

describe('toPrebookPolicyWire', () => {
    it('is an empty object when the supplier sent no policy', () => {
        expect(toPrebookPolicyWire(null)).toEqual({});
        expect(toPrebookPolicyWire(undefined)).toEqual({});
    });

    it('leads a refundable rate with a zero-amount "free until" marker at the first deadline', () => {
        expect(toPrebookPolicyWire(REFUNDABLE)).toEqual({
            refundableTag: 'RFN',
            cancelPolicyInfos: [
                { cancelTime: '2026-11-07T10:00:00.000Z', amount: 0,   currency: 'USD', type: 'AMOUNT' },
                { cancelTime: '2026-11-07T10:00:00.000Z', amount: 120, currency: 'USD', type: 'AMOUNT' },
                // a missing currency falls back to USD on this path, as it always has
                { cancelTime: '2026-11-09T10:00:00.000Z', amount: 100, currency: 'USD', type: 'PERCENT' },
            ],
        });
    });

    it('has no marker for a non-refundable rate', () => {
        expect(toPrebookPolicyWire({ refundable: false, penalties: [] })).toEqual({
            refundableTag: 'NRFN',
            cancelPolicyInfos: [],
        });
    });

    it('defaults a penalty with no type to AMOUNT', () => {
        const wire = toPrebookPolicyWire({
            refundable: false,
            penalties: [{ deadline: '2026-11-01T00:00:00Z', type: '', value: 10, currency: 'USD' }],
        });
        expect(wire.cancelPolicyInfos?.[0].type).toBe('AMOUNT');
    });
});

describe('toStoredPolicyWire', () => {
    it('is null when the booking response carried no policy', () => {
        expect(toStoredPolicyWire(null, 'PHP')).toBeNull();
        expect(toStoredPolicyWire(undefined, 'PHP')).toBeNull();
    });

    it('has no leading marker and falls back to the currency the booking is stored in', () => {
        expect(toStoredPolicyWire(REFUNDABLE, 'PHP')).toEqual({
            refundableTag: 'RFN',
            cancelPolicyInfos: [
                { cancelTime: '2026-11-07T10:00:00.000Z', amount: 120, currency: 'USD', type: 'AMOUNT' },
                { cancelTime: '2026-11-09T10:00:00.000Z', amount: 100, currency: 'PHP', type: 'PERCENT' },
            ],
        });
    });

    it('tags a non-refundable policy NRFN', () => {
        expect(toStoredPolicyWire({ refundable: false, penalties: [] }, 'USD')?.refundableTag).toBe('NRFN');
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.cancellationPolicy.test.ts`
Expected: FAIL — cannot resolve `cancellationPolicy`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/hotels/providers/cancellationPolicy.ts
import type { CancellationTerms } from './types';

/** The shape stored with a booking and read by the policy snapshot and the cancellation engine. */
export interface LegacyCancellationPolicies {
    refundableTag?:     'RFN' | 'NRFN';
    cancelPolicyInfos?: Array<{ cancelTime: string; amount: number; currency: string; type: string }>;
}

/**
 * The policy a prebook response carries to the checkout, and which `confirm` echoes back.
 *
 * A refundable rate with penalty steps gets a leading zero-amount entry at the first deadline —
 * "free until here" — which is what the checkout and the snapshot builder both read the free
 * window from. Lifted unchanged from the service so the wire does not move.
 */
export function toPrebookPolicyWire(terms: CancellationTerms | null | undefined): LegacyCancellationPolicies {
    if (!terms) return {};

    const infos: NonNullable<LegacyCancellationPolicies['cancelPolicyInfos']> = [];
    if (terms.refundable && terms.penalties.length > 0) {
        const first = terms.penalties[0];
        infos.push({ cancelTime: first.deadline, amount: 0, currency: first.currency || 'USD', type: 'AMOUNT' });
    }
    for (const p of terms.penalties) {
        infos.push({ cancelTime: p.deadline, amount: p.value ?? 0, currency: p.currency || 'USD', type: p.type || 'AMOUNT' });
    }
    return { refundableTag: terms.refundable ? 'RFN' : 'NRFN', cancelPolicyInfos: infos };
}

/**
 * The policy recorded when the supplier's own booking response is all there is — a booking taken
 * without a prebook policy. No leading marker, and a missing currency falls back to the one the
 * booking was stored in rather than USD.
 */
export function toStoredPolicyWire(
    terms: CancellationTerms | null | undefined,
    fallbackCurrency: string,
): LegacyCancellationPolicies | null {
    if (!terms) return null;

    return {
        refundableTag: terms.refundable ? 'RFN' : 'NRFN',
        cancelPolicyInfos: terms.penalties.map((p) => ({
            cancelTime: p.deadline,
            amount:     p.value ?? 0,
            currency:   p.currency || fallbackCurrency,
            type:       p.type || 'AMOUNT',
        })),
    };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.cancellationPolicy.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```powershell
git -C $api add src/lib/hotels/providers/cancellationPolicy.ts src/__tests__/hotelProvider.cancellationPolicy.test.ts
git -C $api commit -m @'
feat(hotels): cancellation terms to the legacy policy wire shapes

The prebook policy and the stored policy were built inline in the service.
Lifted out unchanged so a provider can return neutral terms without moving
the wire.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 3: Mock catalog, pricing and scenarios

**Files:**
- Create: `src/lib/hotels/providers/mock/scenarios.ts`
- Create: `src/lib/hotels/providers/mock/catalog.ts`
- Create: `src/lib/hotels/providers/mock/pricing.ts`
- Test: `src/__tests__/hotelProvider.mock.catalog.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/hotelProvider.mock.catalog.test.ts
import { describe, it, expect } from 'vitest';
import { MOCK_HOTELS, MOCK_RATE_PLANS, MOCK_ROOM_TYPES, mockImages } from '@/lib/hotels/providers/mock/catalog';
import { MOCK_SCENARIOS, isMockScenario } from '@/lib/hotels/providers/mock/scenarios';
import { addDays, nightDates, partyFactor, roundMoney, stayTotal } from '@/lib/hotels/providers/mock/pricing';

describe('mock catalog', () => {
    it('has unique ids', () => {
        const ids = MOCK_HOTELS.map((h) => h.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('places every property inside the Philippines and gives it something to be searched by', () => {
        for (const h of MOCK_HOTELS) {
            expect(h.lat).toBeGreaterThan(4);
            expect(h.lat).toBeLessThan(22);
            expect(h.lng).toBeGreaterThan(116);
            expect(h.lng).toBeLessThan(128);
            expect(h.terms.length).toBeGreaterThan(0);
            expect(h.terms.every((t) => t === t.toLowerCase())).toBe(true);
            expect(h.baseNightly).toBeGreaterThan(0);
        }
    });

    it('carries one QA hotel per failure scenario', () => {
        const qa = MOCK_HOTELS.filter((h) => h.scenario);
        expect(qa.map((h) => h.scenario).sort()).toEqual(
            ['book_rejected', 'book_timeout', 'cancel_rejected', 'prebook_timeout', 'price_down', 'price_up', 'sold_out'],
        );
        expect(qa.every((h) => h.name.startsWith('QA '))).toBe(true);
    });

    it('offers three room types and three rate plans', () => {
        expect(MOCK_ROOM_TYPES).toHaveLength(3);
        expect(MOCK_RATE_PLANS.map((p) => p.boardCode)).toEqual(['RO', 'BB', 'HB']);
    });

    it('gives each hotel four deterministic images', () => {
        expect(mockImages('MOCK-MNL-001')).toHaveLength(4);
        expect(mockImages('MOCK-MNL-001')).toEqual(mockImages('MOCK-MNL-001'));
    });
});

describe('mock scenarios', () => {
    it('recognises its own names and nothing else', () => {
        for (const s of MOCK_SCENARIOS) expect(isMockScenario(s)).toBe(true);
        expect(isMockScenario('on_fire')).toBe(false);
        expect(isMockScenario(undefined)).toBe(false);
    });
});

describe('mock pricing', () => {
    const hotel = MOCK_HOTELS.find((h) => h.id === 'MOCK-MNL-001')!;
    const room  = MOCK_ROOM_TYPES[0];
    const plan  = MOCK_RATE_PLANS[1]; // BB, multiplier 1.0
    const base  = { hotel, room, plan, adults: 2, children: 0, currency: 'USD' };

    it('lists the date of each night', () => {
        expect(nightDates('2026-11-10', '2026-11-13')).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
        expect(nightDates('2026-11-10', '2026-11-10')).toEqual(['2026-11-10']);
    });

    it('adds days without a timezone moving the date', () => {
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('prices a Tuesday-to-Thursday stay at base × nights', () => {
        expect(stayTotal({ ...base, checkIn: '2026-11-10', checkOut: '2026-11-12' })).toBe(240);
    });

    it('charges 15% more for Friday and Saturday nights', () => {
        expect(stayTotal({ ...base, checkIn: '2026-11-13', checkOut: '2026-11-15' })).toBe(276);
    });

    it('is a pure function', () => {
        const a = stayTotal({ ...base, checkIn: '2026-11-10', checkOut: '2026-11-12' });
        const b = stayTotal({ ...base, checkIn: '2026-11-10', checkOut: '2026-11-12' });
        expect(a).toBe(b);
    });

    it('charges more for a bigger party', () => {
        expect(partyFactor(2, 0)).toBe(1);
        expect(partyFactor(3, 0)).toBeCloseTo(1.2);
        expect(partyFactor(2, 2)).toBeCloseTo(1.2);
    });

    it('rounds KRW to whole won and other currencies to two decimals', () => {
        expect(roundMoney(1234.5678, 'KRW')).toBe(1235);
        expect(roundMoney(1234.5678, 'USD')).toBe(1234.57);
        const krw = stayTotal({ ...base, currency: 'KRW', checkIn: '2026-11-10', checkOut: '2026-11-12' });
        expect(Number.isInteger(krw)).toBe(true);
        expect(krw).toBe(240 * 1380);
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.mock.catalog.test.ts`
Expected: FAIL — cannot resolve the `mock/*` modules.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/hotels/providers/mock/scenarios.ts
/**
 * The failures the mock supplier can be told to produce.
 *
 * Each one exists because a real supplier does it and the booking flow has to survive it:
 *
 *  - `price_up` / `price_down`   the rate re-prices between listing and prebook
 *  - `sold_out`                  listed, then gone when the traveller commits
 *  - `prebook_timeout`           the supplier does not answer a quote
 *  - `book_rejected`             refused after the traveller has paid — nothing is booked
 *  - `book_timeout`              no answer, but the reservation **was** made: the case where
 *                                voiding the payment would leave a guest holding a room
 *  - `cancel_rejected`           the supplier will not cancel
 *  - `cancel_timeout`            no answer, but the cancellation **was** applied
 */
export const MOCK_SCENARIOS = [
    'ok',
    'price_up',
    'price_down',
    'sold_out',
    'prebook_timeout',
    'book_rejected',
    'book_timeout',
    'cancel_rejected',
    'cancel_timeout',
] as const;

export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export function isMockScenario(value: unknown): value is MockScenario {
    return typeof value === 'string' && (MOCK_SCENARIOS as readonly string[]).includes(value);
}
```

```ts
// src/lib/hotels/providers/mock/catalog.ts
/**
 * The mock supplier's inventory: invented properties in real Philippine areas.
 *
 * Names are fictional on purpose — a mock must never be mistaken for a real property's data —
 * but the coordinates, cities and the way a traveller would type them are real, so search,
 * the map and the destination autocomplete behave as they would on live inventory.
 */

import type { MockScenario } from './scenarios';

export interface MockHotel {
    id:           string;
    name:         string;
    city:         string;
    region:       string;
    /** Lower-case names a traveller might type for this hotel's area. */
    terms:        string[];
    address:      string;
    lat:          number;
    lng:          number;
    stars:        1 | 2 | 3 | 4 | 5;
    /** USD per night for the standard room, midweek, two adults. */
    baseNightly:  number;
    description:  string;
    amenities:    string[];
    checkInTime:  string;
    checkOutTime: string;
    /** QA hotels carry the failure they exist to provoke. */
    scenario?:    MockScenario;
}

export interface MockRoomType {
    code:      string;
    name:      string;
    /** Price multiplier over the standard room. */
    tier:      number;
    maxAdults: number;
}

export type MockPolicy = 'non_refundable' | 'free_until_3d' | 'tiered';

export interface MockRatePlan {
    code:       string;
    boardCode:  'RO' | 'BB' | 'HB';
    multiplier: number;
    policy:     MockPolicy;
    minStars:   number;
}

export const MOCK_ROOM_TYPES: readonly MockRoomType[] = [
    { code: 'STD', name: 'Standard Double Room', tier: 1.0,  maxAdults: 2 },
    { code: 'DLX', name: 'Deluxe King Room',     tier: 1.35, maxAdults: 3 },
    { code: 'FAM', name: 'Family Suite',         tier: 1.9,  maxAdults: 5 },
];

export const MOCK_RATE_PLANS: readonly MockRatePlan[] = [
    { code: 'RO-NR', boardCode: 'RO', multiplier: 0.88, policy: 'non_refundable', minStars: 1 },
    { code: 'BB-FC', boardCode: 'BB', multiplier: 1.0,  policy: 'free_until_3d',  minStars: 1 },
    { code: 'HB-TR', boardCode: 'HB', multiplier: 1.28, policy: 'tiered',         minStars: 4 },
];

export function mockImages(hotelId: string): string[] {
    return [1, 2, 3, 4].map((n) => `https://picsum.photos/seed/${hotelId}-${n}/1200/800`);
}

const BASIC = ['Free WiFi', 'Air conditioning', '24-hour front desk'];
const MID   = [...BASIC, 'Restaurant', 'Room service', 'Breakfast available'];
const HIGH  = [...MID, 'Swimming pool', 'Fitness centre', 'Spa', 'Airport shuttle'];
const BEACH = [...HIGH, 'Beachfront', 'Water sports'];

const QA_DESCRIPTION =
    'A test property. It behaves as its name says when you book it, and never reaches a real supplier.';

const NCR = ['metro manila', 'ncr', 'national capital region'];

export const MOCK_HOTELS: readonly MockHotel[] = [
    // ── Metro Manila ─────────────────────────────────────────────────────────
    {
        id: 'MOCK-MNL-001', name: 'Bayside Grand Manila', city: 'Manila', region: 'Metro Manila',
        terms: ['manila', 'manila city', 'ermita', 'roxas boulevard', ...NCR],
        address: 'Roxas Boulevard, Ermita, Manila', lat: 14.5832, lng: 120.9794, stars: 5, baseNightly: 120,
        description: 'A waterfront hotel on Manila Bay with a rooftop pool and sunset views over the bay.',
        amenities: HIGH, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-MKT-001', name: 'Ayala Triangle Suites', city: 'Makati', region: 'Metro Manila',
        terms: ['makati', 'makati city', 'ayala', 'ayala triangle', 'greenbelt', ...NCR],
        address: 'Paseo de Roxas, Makati', lat: 14.5547, lng: 121.0244, stars: 5, baseNightly: 160,
        description: 'Serviced suites in the heart of the Makati business district, a short walk from Greenbelt.',
        amenities: HIGH, checkInTime: '15:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-MKT-002', name: 'Salcedo Village Residences', city: 'Makati', region: 'Metro Manila',
        terms: ['makati', 'makati city', 'salcedo village', 'legazpi village', ...NCR],
        address: 'Tordesillas Street, Salcedo Village, Makati', lat: 14.5608, lng: 121.0198, stars: 4, baseNightly: 95,
        description: 'A quiet residential-style hotel among the cafés and restaurants of Salcedo Village.',
        amenities: MID, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-BGC-001', name: 'Fort Bonifacio Skyline Hotel', city: 'Taguig City', region: 'Metro Manila',
        terms: ['taguig', 'taguig city', 'bgc', 'bonifacio global city', 'fort bonifacio', 'the fort', ...NCR],
        address: '5th Avenue, Bonifacio Global City, Taguig', lat: 14.5509, lng: 121.0503, stars: 5, baseNightly: 150,
        description: 'A high-rise hotel in Bonifacio Global City with a sky lounge and a tree-lined high street below.',
        amenities: HIGH, checkInTime: '15:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-BGC-002', name: 'Uptown Bonifacio Inn', city: 'Taguig City', region: 'Metro Manila',
        terms: ['taguig', 'taguig city', 'bgc', 'bonifacio global city', 'uptown bonifacio', ...NCR],
        address: '36th Street, Uptown Bonifacio, Taguig', lat: 14.5586, lng: 121.056, stars: 3, baseNightly: 55,
        description: 'A compact, good-value inn a few minutes from the Uptown Mall.',
        amenities: BASIC, checkInTime: '14:00', checkOutTime: '12:00',
    },

    // ── Cebu ─────────────────────────────────────────────────────────────────
    {
        id: 'MOCK-CEB-001', name: 'Cebu IT Park Plaza Hotel', city: 'Cebu City', region: 'Cebu',
        terms: ['cebu', 'cebu city', 'it park', 'lahug'],
        address: 'Jose Maria del Mar Street, Cebu IT Park, Cebu City', lat: 10.328, lng: 123.9055, stars: 4, baseNightly: 80,
        description: 'A business hotel at Cebu IT Park with a pool deck and a 24-hour café.',
        amenities: HIGH, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-CEB-002', name: 'Mactan Shoreline Resort', city: 'Lapu-Lapu City', region: 'Cebu',
        terms: ['mactan', 'lapu-lapu', 'lapu lapu', 'lapu-lapu city', 'cebu'],
        address: 'Punta Engaño Road, Mactan Island, Lapu-Lapu City', lat: 10.2760, lng: 124.0210, stars: 5, baseNightly: 140,
        description: 'A beachfront resort on Mactan Island with a lagoon pool and a dive centre.',
        amenities: BEACH, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-CEB-003', name: 'Colon Heritage Lodge', city: 'Cebu City', region: 'Cebu',
        terms: ['cebu', 'cebu city', 'colon', 'downtown cebu'],
        address: 'Colon Street, Cebu City', lat: 10.295, lng: 123.902, stars: 2, baseNightly: 35,
        description: 'Simple rooms on the oldest street in the Philippines, close to Basilica del Santo Niño.',
        amenities: BASIC, checkInTime: '13:00', checkOutTime: '11:00',
    },

    // ── Visayas and Palawan ──────────────────────────────────────────────────
    {
        id: 'MOCK-BOR-001', name: 'White Beach Station 2 Resort', city: 'Malay', region: 'Aklan',
        terms: ['boracay', 'malay', 'white beach', 'station 2', 'boracay island'],
        address: 'Station 2, White Beach, Boracay Island, Malay', lat: 11.9674, lng: 121.9248, stars: 4, baseNightly: 130,
        description: 'A beachfront resort on White Beach with an open-air restaurant on the sand.',
        amenities: BEACH, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-BOR-002', name: 'Bulabog Surf Hostel', city: 'Malay', region: 'Aklan',
        terms: ['boracay', 'malay', 'bulabog', 'boracay island'],
        address: 'Bulabog Beach, Boracay Island, Malay', lat: 11.974, lng: 121.933, stars: 2, baseNightly: 28,
        description: 'A relaxed hostel on the windward side of the island, popular with kitesurfers.',
        amenities: BASIC, checkInTime: '13:00', checkOutTime: '11:00',
    },
    {
        id: 'MOCK-ELN-001', name: 'El Nido Cliffside Villas', city: 'El Nido', region: 'Palawan',
        terms: ['el nido', 'palawan', 'bacuit bay'],
        address: 'Corong-Corong, El Nido, Palawan', lat: 11.1784, lng: 119.393, stars: 4, baseNightly: 150,
        description: 'Villas on a cliff over Bacuit Bay, with private terraces and an infinity pool.',
        amenities: BEACH, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-COR-001', name: 'Coron Bay View Lodge', city: 'Coron', region: 'Palawan',
        terms: ['coron', 'palawan', 'busuanga'],
        address: 'Barangay 2, Coron, Palawan', lat: 11.9986, lng: 120.2043, stars: 3, baseNightly: 70,
        description: 'A hillside lodge overlooking Coron Bay and the limestone islands beyond it.',
        amenities: MID, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-SGU-001', name: 'Cloud 9 Surf Camp & Villas', city: 'General Luna', region: 'Siargao',
        terms: ['siargao', 'general luna', 'cloud 9', 'siargao island'],
        address: 'Tourism Road, General Luna, Siargao', lat: 9.8146, lng: 126.158, stars: 3, baseNightly: 85,
        description: 'Garden villas a short walk from the Cloud 9 boardwalk, with a surf school on site.',
        amenities: MID, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-BOH-001', name: 'Alona Beach Panglao Resort', city: 'Panglao', region: 'Bohol',
        terms: ['panglao', 'bohol', 'alona beach', 'tagbilaran'],
        address: 'Alona Beach, Tawala, Panglao, Bohol', lat: 9.5476, lng: 123.7838, stars: 4, baseNightly: 110,
        description: 'A beach resort on Alona Beach with a dive shop and a poolside bar.',
        amenities: BEACH, checkInTime: '14:00', checkOutTime: '12:00',
    },

    // ── Mindanao and Luzon highlands ─────────────────────────────────────────
    {
        id: 'MOCK-DVO-001', name: 'Davao Riverfront Hotel', city: 'Davao City', region: 'Davao',
        terms: ['davao', 'davao city'],
        address: 'R. Castillo Street, Davao City', lat: 7.0644, lng: 125.6074, stars: 4, baseNightly: 75,
        description: 'A modern city hotel beside the river with a rooftop pool and a durian-free lobby.',
        amenities: HIGH, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-BAG-001', name: 'Camp John Hay Pine Lodge', city: 'Baguio', region: 'Benguet',
        terms: ['baguio', 'baguio city', 'camp john hay'],
        address: 'Loakan Road, Camp John Hay, Baguio', lat: 16.4023, lng: 120.596, stars: 3, baseNightly: 60,
        description: 'A pine-forest lodge with fireplaces and cool mountain air year round.',
        amenities: MID, checkInTime: '14:00', checkOutTime: '12:00',
    },
    {
        id: 'MOCK-TAG-001', name: 'Taal Lake Ridge Hotel', city: 'Tagaytay', region: 'Cavite',
        terms: ['tagaytay', 'taal', 'taal lake'],
        address: 'Tagaytay-Nasugbu Highway, Tagaytay', lat: 14.1119, lng: 120.962, stars: 4, baseNightly: 90,
        description: 'A ridge-top hotel with a view of Taal Volcano from every room.',
        amenities: HIGH, checkInTime: '14:00', checkOutTime: '12:00',
    },

    // ── QA properties: each one provokes a failure ───────────────────────────
    qa('MOCK-QA-SOLDOUT',    'QA Sold-Out Inn',          'sold_out',        14.5701, 120.9902),
    qa('MOCK-QA-PRICEUP',    'QA Price-Rise Hotel',      'price_up',        14.5712, 120.9911),
    qa('MOCK-QA-PRICEDOWN',  'QA Price-Drop Hotel',      'price_down',      14.5689, 120.9893),
    qa('MOCK-QA-PBTIMEOUT',  'QA Prebook-Timeout Hotel', 'prebook_timeout', 14.5722, 120.9921),
    qa('MOCK-QA-BOOKFAIL',   'QA Booking-Rejected Hotel','book_rejected',   14.5679, 120.9884),
    qa('MOCK-QA-BOOKTIMEOUT','QA Booking-Timeout Hotel', 'book_timeout',    14.5732, 120.9931),
    qa('MOCK-QA-CANCELFAIL', 'QA Cancel-Rejected Hotel', 'cancel_rejected', 14.5669, 120.9874),
];

function qa(id: string, name: string, scenario: MockScenario, lat: number, lng: number): MockHotel {
    return {
        id, name, city: 'Manila', region: 'Metro Manila',
        terms: ['manila', 'manila city', 'qa', 'mock qa', ...NCR],
        address: 'Malate, Manila', lat, lng, stars: 4, baseNightly: 70,
        description: QA_DESCRIPTION, amenities: MID, checkInTime: '14:00', checkOutTime: '12:00',
        scenario,
    };
}
```

```ts
// src/lib/hotels/providers/mock/pricing.ts
import { nightsBetween } from '@/lib/hotels/nights';
import type { MockHotel, MockRatePlan, MockRoomType } from './catalog';

/** Fixed, so a mock price never depends on today's exchange rates. */
const FX_PER_USD: Readonly<Record<string, number>> = { USD: 1, PHP: 56, KRW: 1380, EUR: 0.92 };
const ZERO_DECIMAL = new Set(['KRW']);

export const MOCK_DEFAULT_CURRENCY = 'USD';

export function mockSupportsCurrency(currency: string): boolean {
    return currency.toUpperCase() in FX_PER_USD;
}

export function roundMoney(amount: number, currency: string): number {
    return ZERO_DECIMAL.has(currency.toUpperCase())
        ? Math.round(amount)
        : Math.round(amount * 100) / 100;
}

/** YYYY-MM-DD plus whole days, in UTC so no timezone can move the date. */
export function addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** The date of each night of the stay. A same-day or unreadable range is one night, as everywhere else. */
export function nightDates(checkIn: string, checkOut: string): string[] {
    const nights = nightsBetween(checkIn, checkOut);
    return Array.from({ length: nights }, (_, i) => addDays(checkIn, i));
}

/** Friday and Saturday nights cost more. */
function weekendFactor(date: string): number {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    return day === 5 || day === 6 ? 1.15 : 1;
}

export function partyFactor(adults: number, children: number): number {
    return 1 + 0.2 * Math.max(0, adults - 2) + 0.1 * Math.max(0, children);
}

export interface PriceArgs {
    hotel:    MockHotel;
    room:     MockRoomType;
    plan:     MockRatePlan;
    checkIn:  string;
    checkOut: string;
    adults:   number;
    children: number;
    currency: string;
}

/** The whole-stay total in `currency`. A pure function of its arguments. */
export function stayTotal(a: PriceArgs): number {
    const perNightUsd = a.hotel.baseNightly * a.room.tier * a.plan.multiplier * partyFactor(a.adults, a.children);
    const usd  = nightDates(a.checkIn, a.checkOut).reduce((sum, d) => sum + perNightUsd * weekendFactor(d), 0);
    const rate = FX_PER_USD[a.currency.toUpperCase()] ?? 1;
    return roundMoney(usd * rate, a.currency);
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.mock.catalog.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```powershell
git -C $api add src/lib/hotels/providers/mock src/__tests__/hotelProvider.mock.catalog.test.ts
git -C $api commit -m @'
feat(hotels): mock supplier catalog, pricing and scenarios

Twenty-four invented properties in real Philippine areas, three room types and
three rate plans, a pure price function, and seven QA hotels that each provoke
one failure.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 4: `MockHotelProvider`

**Files:**
- Create: `src/lib/hotels/providers/mock/MockHotelProvider.ts`
- Test: `src/__tests__/hotelProvider.mock.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/hotelProvider.mock.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MockHotelProvider } from '@/lib/hotels/providers/mock/MockHotelProvider';
import { HotelProviderError } from '@/lib/hotels/providers/types';
import type { HotelProviderErrorCode } from '@/lib/hotels/providers/types';

const NOW     = Date.parse('2026-10-14T00:00:00Z');
const WEEKDAY = { checkIn: '2026-11-10', checkOut: '2026-11-12' }; // Tue → Thu, two nights
const WEEKEND = { checkIn: '2026-11-13', checkOut: '2026-11-15' }; // Fri → Sun, two nights
const HOTEL   = 'MOCK-MNL-001';                                    // base 120 USD, 5 stars

let mock: MockHotelProvider;
beforeEach(() => { mock = new MockHotelProvider({ now: () => NOW }); });

const search = (p: MockHotelProvider, cityName = 'Manila', dates = WEEKDAY) =>
    p.searchHotels({ cityName, checkin: dates.checkIn, checkout: dates.checkOut, adults: 2, children: 0 });

async function rateOf(p: MockHotelProvider, hotelId: string, board: 'RO' | 'BB' | 'HB', dates = WEEKDAY) {
    const rates = await p.getRates(hotelId, { ...dates, adults: 2, children: 0 });
    const found = rates.find((r) => r.roomName === 'Standard Double Room' && r.boardCode === board);
    if (!found) throw new Error(`no ${board} rate for ${hotelId}`);
    return found;
}

async function prebookOf(p: MockHotelProvider, hotelId: string, board: 'RO' | 'BB' | 'HB' = 'BB', dates = WEEKDAY) {
    const rate = await rateOf(p, hotelId, board, dates);
    return p.prebook({ offerId: rate.offerId, roomName: rate.roomName, adults: 2, children: 0, currency: 'USD' });
}

const bookInput = (prebookRef: string, clientRef = 'CG-TEST01') => ({
    prebookRef,
    clientRef,
    holder: { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' },
    guests: [{ firstName: 'Juan', lastName: 'dela Cruz', age: 30, type: 'adult' as const }],
    stay:   { adults: 1, children: 0, currency: 'USD' },
});

async function expectCode(p: Promise<unknown>, code: HotelProviderErrorCode) {
    const err = await p.then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(HotelProviderError);
    expect((err as HotelProviderError).code).toBe(code);
}

describe('MockHotelProvider — identity', () => {
    it('owns MOCK: references and nothing else', () => {
        expect(mock.ownsRef('MOCK:abc')).toBe(true);
        expect(mock.ownsRef('TGX:abc')).toBe(false);
        expect(mock.ownsRef('')).toBe(false);
    });

    it('is the authority on content and can read bookings back', () => {
        expect(mock.id).toBe('mock');
        expect(mock.capabilities).toEqual({ bookingRead: true, providesContent: true });
    });
});

describe('MockHotelProvider — search', () => {
    it('finds the hotels of a city, as supplier-neutral listings priced per night', async () => {
        const out = await search(mock);
        const ids = out.data.map((h: { id: string }) => h.id);
        expect(ids).toContain(HOTEL);
        expect(ids.every((id: string) => id.startsWith('MOCK-MNL') || id.startsWith('MOCK-QA'))).toBe(true);

        const grand = out.data.find((h: { id: string }) => h.id === HOTEL);
        expect(grand.provider).toBe('mock');
        expect(grand.currency).toBe('USD');
        expect(mock.ownsRef(grand.offerId)).toBe(true);
        // cheapest rate is room-only, 120 × 0.88 × 2 nights = 211.20 for the stay
        expect(grand.price).toBeCloseTo(105.6, 2);
        expect(grand.roomTypes[0].gross).toBeCloseTo(211.2, 2);
        expect(out.totalCount).toBe(out.data.length);
    });

    it('is deterministic', async () => {
        expect(await search(mock)).toEqual(await search(mock));
    });

    it('matches the way a traveller types a place', async () => {
        const ncr = (await search(mock, 'Metro Manila')).data.map((h: { id: string }) => h.id);
        expect(ncr).toContain('MOCK-MKT-001');
        expect(ncr).toContain('MOCK-BGC-001');

        const bgc = (await search(mock, 'BGC')).data.map((h: { id: string }) => h.id);
        expect(bgc.sort()).toEqual(['MOCK-BGC-001', 'MOCK-BGC-002']);

        const withCountry = (await search(mock, 'Boracay, Philippines')).data.map((h: { id: string }) => h.id);
        expect(withCountry.sort()).toEqual(['MOCK-BOR-001', 'MOCK-BOR-002']);
    });

    it('falls back to distance when the name is not recognised', async () => {
        const out = await mock.searchHotels({
            cityName: 'Somewhere Else', lat: 10.3157, lng: 123.8854, // central Cebu
            checkin: WEEKDAY.checkIn, checkout: WEEKDAY.checkOut, adults: 2, children: 0,
        });
        expect(out.data.map((h: { id: string }) => h.id)).toEqual(
            expect.arrayContaining(['MOCK-CEB-001', 'MOCK-CEB-003']),
        );
    });

    it('finds one hotel by code, and nothing for an unknown place', async () => {
        const one = await mock.searchHotels({ hotelCode: HOTEL, checkin: WEEKDAY.checkIn, checkout: WEEKDAY.checkOut });
        expect(one.data).toHaveLength(1);

        const none = await search(mock, 'Atlantis');
        expect(none.data).toEqual([]);
        expect(none.totalCount).toBe(0);
    });
});

describe('MockHotelProvider — details and rates', () => {
    it('returns the content of a known hotel and null for an unknown one', async () => {
        const c = await mock.getHotelDetails(HOTEL);
        expect(c).toMatchObject({ hotelId: HOTEL, name: 'Bayside Grand Manila', city: 'Manila', starRating: 5 });
        expect(c?.images).toHaveLength(4);
        expect(await mock.getHotelDetails('NOPE')).toBeNull();
    });

    it('prices a stay as a whole-stay total, with a weekend uplift', async () => {
        const weekday = await rateOf(mock, HOTEL, 'BB', WEEKDAY);
        const weekend = await rateOf(mock, HOTEL, 'BB', WEEKEND);
        expect(weekday.price).toBe(240);
        expect(weekday.gross).toBe(240);
        expect(weekday.net).toBe(216);
        expect(weekend.price).toBe(276);
        expect(mock.ownsRef(weekday.offerId)).toBe(true);
    });

    it('offers every room with the rate plans its star rating allows', async () => {
        const rates = await mock.getRates(HOTEL, { ...WEEKDAY, adults: 2, children: 0 });
        // 2-adult party fits all three rooms; a 5-star has all three plans
        expect(rates).toHaveLength(9);
        const budget = await mock.getRates('MOCK-CEB-003', { ...WEEKDAY, adults: 2, children: 0 });
        expect(budget.map((r) => r.boardCode).includes('HB')).toBe(false);
    });

    it('drops rooms too small for the party', async () => {
        const rates = await mock.getRates(HOTEL, { ...WEEKDAY, adults: 4, children: 0 });
        expect(new Set(rates.map((r) => r.roomName))).toEqual(new Set(['Family Suite']));
    });

    it('returns no rates for an unknown hotel', async () => {
        expect(await mock.getRates('NOPE', { ...WEEKDAY, adults: 2, children: 0 })).toEqual([]);
    });

    it('describes refundability in the neutral rate shape', async () => {
        const ro = await rateOf(mock, HOTEL, 'RO');
        const bb = await rateOf(mock, HOTEL, 'BB');
        expect(ro.refundable).toBe(false);
        expect(ro.refundableTag).toBe('NRFN');
        expect(bb.refundable).toBe(true);
        expect(bb.refundableTag).toBe('RFN');
        expect(bb.cancelPolicy?.cancelPenalties?.[0].deadline).toBe('2026-11-07T10:00:00.000Z');
    });
});

describe('MockHotelProvider — prebook', () => {
    it('re-prices the rate and returns the terms it was quoted with', async () => {
        const q = await prebookOf(mock, HOTEL, 'BB');
        expect(mock.ownsRef(q.prebookRef)).toBe(true);
        expect(q.price).toEqual({ net: 216, gross: 240, currency: 'USD' });
        expect(q.checkIn).toBe('2026-11-10');
        expect(q.checkOut).toBe('2026-11-12');
        expect(q.roomName).toBe('Standard Double Room');
        expect(q.roomSubstituted).toBe(false);
        expect(q.boardCode).toBe('BB');
        expect(q.cancellation?.refundable).toBe(true);
        expect(q.cancellation?.penalties).toHaveLength(2);
        expect(q.rooms[0]).toMatchObject({ code: 'STD', occupancyRefId: 1 });
    });

    it('refuses a reference that is not its own, or is unreadable', async () => {
        await expectCode(mock.prebook({ offerId: 'TGX:d1[b261110[c261112', adults: 2, children: 0, currency: 'USD' }), 'INVALID_RATE');
        await expectCode(mock.prebook({ offerId: 'MOCK:!!!', adults: 2, children: 0, currency: 'USD' }), 'INVALID_RATE');
    });

    it('re-prices up 8% under the price_up scenario', async () => {
        mock.setScenario('price_up');
        expect((await prebookOf(mock, HOTEL)).price.gross).toBeCloseTo(259.2, 2);
    });

    it('re-prices down 5% under price_down', async () => {
        mock.setScenario('price_down');
        expect((await prebookOf(mock, HOTEL)).price.gross).toBeCloseTo(228, 2);
    });

    it('says sold out under sold_out, and times out under prebook_timeout', async () => {
        mock.setScenario('sold_out');
        await expectCode(prebookOf(mock, HOTEL), 'SOLD_OUT');
        mock.setScenario('prebook_timeout');
        await expectCode(prebookOf(mock, HOTEL), 'TIMEOUT');
    });

    it('lets a QA hotel carry its own scenario, which a forced scenario overrides', async () => {
        await expectCode(prebookOf(mock, 'MOCK-QA-SOLDOUT'), 'SOLD_OUT');
        mock.setScenario('ok');
        expect((await prebookOf(mock, 'MOCK-QA-SOLDOUT')).price.gross).toBeGreaterThan(0);
    });
});

describe('MockHotelProvider — book', () => {
    it('makes a reservation filed under our client reference', async () => {
        const q = await prebookOf(mock, HOTEL);
        const b = await mock.book(bookInput(q.prebookRef));

        expect(b).toMatchObject({
            provider: 'mock', status: 'OK', clientRef: 'CG-TEST01',
            hotelCode: HOTEL, hotelName: 'Bayside Grand Manila',
        });
        expect(b.supplierRef).toMatch(/^MOCKSUP-\d{6}$/);
        expect(b.price).toEqual({ net: 216, gross: 240, currency: 'USD' });
        expect(b.cancellation?.refundable).toBe(true);
        expect(mock.reservations).toHaveLength(1);
    });

    it('can be read back by either reference', async () => {
        const q = await prebookOf(mock, HOTEL);
        const b = await mock.book(bookInput(q.prebookRef));
        expect((await mock.getBooking({ clientRef: 'CG-TEST01' }))?.supplierRef).toBe(b.supplierRef);
        expect((await mock.getBooking({ supplierRef: b.supplierRef }))?.clientRef).toBe('CG-TEST01');
        expect(await mock.getBooking({ clientRef: 'CG-NOPE' })).toBeNull();
    });

    it('is a naive supplier: a repeated client reference books twice unless told to dedupe', async () => {
        const q = await prebookOf(mock, HOTEL);
        await mock.book(bookInput(q.prebookRef, 'CG-DUP'));
        await mock.book(bookInput(q.prebookRef, 'CG-DUP'));
        expect(mock.reservations).toHaveLength(2);

        const strict = new MockHotelProvider({ now: () => NOW, dedupeByClientRef: true });
        const q2 = await prebookOf(strict, HOTEL);
        const first  = await strict.book(bookInput(q2.prebookRef, 'CG-DUP'));
        const second = await strict.book(bookInput(q2.prebookRef, 'CG-DUP'));
        expect(strict.reservations).toHaveLength(1);
        expect(second.supplierRef).toBe(first.supplierRef);
    });

    it('refuses a reference that is not a prebook', async () => {
        const rate = await rateOf(mock, HOTEL, 'BB');
        await expectCode(mock.book(bookInput(rate.offerId)), 'INVALID_RATE');
        await expectCode(mock.book(bookInput('TGX:abc')), 'INVALID_RATE');
    });

    it('refuses a booking with no guests', async () => {
        const q = await prebookOf(mock, HOTEL);
        await expectCode(mock.book({ ...bookInput(q.prebookRef), guests: [] }), 'REJECTED');
    });

    it('rejects under book_rejected and books nothing', async () => {
        const q = await prebookOf(mock, 'MOCK-QA-BOOKFAIL');
        await expectCode(mock.book(bookInput(q.prebookRef)), 'REJECTED');
        expect(mock.reservations).toHaveLength(0);
    });

    it('times out under book_timeout — and the reservation exists', async () => {
        const q = await prebookOf(mock, 'MOCK-QA-BOOKTIMEOUT');
        await expectCode(mock.book(bookInput(q.prebookRef)), 'UNKNOWN_OUTCOME');
        expect(mock.reservations).toHaveLength(1);
        expect(await mock.getBooking({ clientRef: 'CG-TEST01' })).toMatchObject({ status: 'OK' });
    });
});

describe('MockHotelProvider — cancel', () => {
    async function booked(p: MockHotelProvider, hotelId = HOTEL, board: 'RO' | 'BB' | 'HB' = 'BB') {
        const q = await prebookOf(p, hotelId, board);
        return p.book(bookInput(q.prebookRef));
    }

    it('cancels and refunds everything inside the free window', async () => {
        const b = await booked(mock);
        const c = await mock.cancelBooking({ clientRef: 'CG-TEST01', supplierRef: b.supplierRef });
        expect(c).toMatchObject({ status: 'CANCELLED', clientRef: 'CG-TEST01', refundAmount: 240, currency: 'USD' });
        expect(await mock.getBooking({ clientRef: 'CG-TEST01' })).toMatchObject({ status: 'CANCELLED' });
    });

    it('refunds nothing on a non-refundable rate', async () => {
        await booked(mock, HOTEL, 'RO');
        const c = await mock.cancelBooking({ clientRef: 'CG-TEST01' });
        expect(c.refundAmount).toBe(0);
    });

    it('charges the penalty in force once the free window has closed', async () => {
        const late = new MockHotelProvider({ now: () => Date.parse('2026-11-08T00:00:00Z') });
        await booked(late);
        const c = await late.cancelBooking({ clientRef: 'CG-TEST01' });
        // first night (120) is the penalty after 3 days out; the rest comes back
        expect(c.refundAmount).toBe(120);
    });

    it('charges a percentage on a tiered rate', async () => {
        const mid = new MockHotelProvider({ now: () => Date.parse('2026-11-05T00:00:00Z') });
        await booked(mid, HOTEL, 'HB');
        const gross = (await mid.getBooking({ clientRef: 'CG-TEST01' }))?.price?.gross ?? 0;
        const c = await mid.cancelBooking({ clientRef: 'CG-TEST01' });
        expect(c.refundAmount).toBeCloseTo(gross * 0.5, 2);
    });

    it('rejects an unknown booking and a second cancellation', async () => {
        await expectCode(mock.cancelBooking({ clientRef: 'CG-NOPE' }), 'REJECTED');
        await booked(mock);
        await mock.cancelBooking({ clientRef: 'CG-TEST01' });
        await expectCode(mock.cancelBooking({ clientRef: 'CG-TEST01' }), 'REJECTED');
    });

    it('refuses under cancel_rejected and leaves the booking standing', async () => {
        await booked(mock, 'MOCK-QA-CANCELFAIL');
        await expectCode(mock.cancelBooking({ clientRef: 'CG-TEST01' }), 'REJECTED');
        expect(await mock.getBooking({ clientRef: 'CG-TEST01' })).toMatchObject({ status: 'OK' });
    });

    it('times out under cancel_timeout — and the cancellation was applied', async () => {
        await booked(mock);
        mock.setScenario('cancel_timeout');
        await expectCode(mock.cancelBooking({ clientRef: 'CG-TEST01' }), 'UNKNOWN_OUTCOME');
        expect(await mock.getBooking({ clientRef: 'CG-TEST01' })).toMatchObject({ status: 'CANCELLED' });
    });
});

describe('MockHotelProvider — instrumentation', () => {
    it('logs each call so a test can assert a supplier was asked exactly once', async () => {
        const q = await prebookOf(mock, HOTEL);
        await mock.book(bookInput(q.prebookRef));
        expect(mock.calls.filter((c) => c.method === 'book')).toHaveLength(1);
        expect(mock.calls.map((c) => c.method)).toEqual(
            expect.arrayContaining(['getRates', 'prebook', 'book']),
        );
    });

    it('forgets everything on reset', async () => {
        const q = await prebookOf(mock, HOTEL);
        await mock.book(bookInput(q.prebookRef));
        mock.setScenario('sold_out');
        mock.reset();
        expect(mock.reservations).toHaveLength(0);
        expect(mock.calls).toHaveLength(0);
        expect((await prebookOf(mock, HOTEL)).price.gross).toBe(240);
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.mock.test.ts`
Expected: FAIL — cannot resolve `MockHotelProvider`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/hotels/providers/mock/MockHotelProvider.ts
/**
 * A hotel supplier that exists only in this process.
 *
 * It is deterministic — the same query always gives the same answer — and it fails on demand:
 * see `scenarios.ts`. It never touches the network, the database or a credential, which is the
 * point of it: the whole booking flow can be exercised, by a test or by a person in the
 * browser, without a supplier being asked anything.
 *
 * It is deliberately a *naive* supplier. A second `book` with a client reference it has already
 * seen makes a second reservation, because a double-submit bug in the flow should be visible as
 * two reservations rather than hidden by a forgiving fake.
 */

import type { HotelListing, HotelSearchParams, HotelSearchResult, RoomType } from '@/types/hotels';
import { nightsBetween } from '@/lib/hotels/nights';
import {
    HotelProviderError,
    type BookInput,
    type CancelInput,
    type CancellationTerms,
    type HotelContent,
    type HotelProvider,
    type PrebookInput,
    type PrebookResult,
    type ProviderBooking,
    type ProviderBookingRef,
    type ProviderCancellation,
    type ProviderCapabilities,
    type StayQuery,
} from '../types';
import {
    MOCK_HOTELS,
    MOCK_RATE_PLANS,
    MOCK_ROOM_TYPES,
    mockImages,
    type MockHotel,
    type MockRatePlan,
    type MockRoomType,
} from './catalog';
import { MOCK_DEFAULT_CURRENCY, addDays, mockSupportsCurrency, roundMoney, stayTotal } from './pricing';
import type { MockScenario } from './scenarios';

const PREFIX = 'MOCK:';

const UNAVAILABLE_MESSAGE =
    'This room is currently unavailable for booking. Please try a different hotel or check back later.';

export interface MockHotelProviderOptions {
    /** Forces one scenario on every hotel. Beats a hotel's own. */
    scenario?:          MockScenario;
    /** What the supplier quotes in. Defaults to USD, which exercises the FX path. */
    currency?:          string;
    /** The clock, so cancellation windows are testable. */
    now?:               () => number;
    /** A real supplier may or may not refuse a repeated client reference; the default is "does not". */
    dedupeByClientRef?: boolean;
}

interface BaseRef {
    v:   1;
    h:   string;   // hotel id
    r:   string;   // room code
    p:   string;   // rate plan code
    in:  string;   // check-in
    out: string;   // check-out
    a:   number;   // adults
    c:   number;   // children
    cur: string;   // currency
}
interface OfferRef   extends BaseRef { k: 'offer' }
interface PrebookRef extends BaseRef { k: 'prebook'; net: number; gross: number }

interface Reservation {
    clientRef:   string;
    supplierRef: string;
    ref:         PrebookRef;
    status:      'OK' | 'CANCELLED';
}

function encode(ref: OfferRef | PrebookRef): string {
    return PREFIX + Buffer.from(JSON.stringify(ref)).toString('base64url');
}

function decode<T extends OfferRef | PrebookRef>(value: string, kind: T['k']): T | null {
    if (!value.startsWith(PREFIX)) return null;
    try {
        const parsed = JSON.parse(Buffer.from(value.slice(PREFIX.length), 'base64url').toString('utf8'));
        return parsed && parsed.v === 1 && parsed.k === kind ? (parsed as T) : null;
    } catch {
        return null;
    }
}

function normalise(text: string): string {
    return text.split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(bLat - aLat);
    const dLng = rad(bLng - aLng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function hashOf(text: string): number {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return h;
}

export class MockHotelProvider implements HotelProvider {
    readonly id           = 'mock' as const;
    readonly displayName  = 'the mock supplier';
    readonly capabilities: ProviderCapabilities = { bookingRead: true, providesContent: true };

    /** Every call made, in order. A test asserts a supplier was asked exactly once from this. */
    readonly calls: Array<{ method: string; input: unknown }> = [];

    private readonly store = new Map<string, Reservation>();
    private sequence = 0;
    private override: MockScenario | undefined;

    private readonly currency: string;
    private readonly now: () => number;

    constructor(private readonly options: MockHotelProviderOptions = {}) {
        const wanted = options.currency?.toUpperCase();
        this.currency = wanted && mockSupportsCurrency(wanted) ? wanted : MOCK_DEFAULT_CURRENCY;
        this.now = options.now ?? Date.now;
    }

    // ── Test controls ───────────────────────────────────────────────────────

    /** Forces a scenario on every hotel until `reset()`. */
    setScenario(scenario: MockScenario | undefined): void {
        this.override = scenario;
    }

    /** Every reservation held, cancelled ones included. */
    get reservations(): ProviderBooking[] {
        return [...this.store.values()].map((r) => this.toBooking(r));
    }

    reset(): void {
        this.store.clear();
        this.calls.length = 0;
        this.sequence = 0;
        this.override = undefined;
    }

    // ── HotelProvider ───────────────────────────────────────────────────────

    ownsRef(ref: string): boolean {
        return typeof ref === 'string' && ref.startsWith(PREFIX);
    }

    async searchHotels(q: HotelSearchParams): Promise<HotelSearchResult> {
        this.record('searchHotels', q);

        const stay = this.stayOf({
            checkIn: q.checkin, checkOut: q.checkout, adults: q.adults ?? 2, children: q.children ?? 0,
        });
        const nights = nightsBetween(stay.checkIn, stay.checkOut);

        const data: HotelListing[] = this.matchHotels(q).flatMap((hotel) => {
            const rates = this.ratesFor(hotel, stay);
            if (!rates.length) return [];
            const cheapest = rates.reduce((a, b) => (b.gross < a.gross ? b : a));
            return [this.toListing(hotel, cheapest, roundMoney(cheapest.gross / nights, this.currency))];
        });

        return { data, allMappable: data.filter((h) => h.lat && h.lng), totalCount: data.length };
    }

    async getHotelDetails(hotelId: string): Promise<HotelContent | null> {
        this.record('getHotelDetails', { hotelId });
        const hotel = MOCK_HOTELS.find((h) => h.id === hotelId);
        if (!hotel) return null;
        return {
            hotelId:      hotel.id,
            name:         hotel.name,
            address:      hotel.address,
            city:         hotel.city,
            country:      'PH',
            lat:          hotel.lat,
            lng:          hotel.lng,
            starRating:   hotel.stars,
            description:  hotel.description,
            images:       mockImages(hotel.id),
            amenities:    [...hotel.amenities],
            checkInTime:  hotel.checkInTime,
            checkOutTime: hotel.checkOutTime,
        };
    }

    async getRates(hotelId: string, stay: StayQuery): Promise<RoomType[]> {
        this.record('getRates', { hotelId, stay });
        const hotel = MOCK_HOTELS.find((h) => h.id === hotelId);
        if (!hotel) return [];
        return this.ratesFor(hotel, this.stayOf(stay));
    }

    async prebook(input: PrebookInput): Promise<PrebookResult> {
        this.record('prebook', input);

        if (!this.ownsRef(input.offerId)) {
            throw new HotelProviderError('INVALID_RATE', 'This hotel is not available for instant online booking.', { provider: 'mock' });
        }
        const ref = decode<OfferRef>(input.offerId, 'offer');
        const hotel = ref && MOCK_HOTELS.find((h) => h.id === ref.h);
        const room  = ref && MOCK_ROOM_TYPES.find((r) => r.code === ref.r);
        const plan  = ref && MOCK_RATE_PLANS.find((p) => p.code === ref.p);
        if (!ref || !hotel || !room || !plan) {
            throw new HotelProviderError('INVALID_RATE', 'Invalid mock offer id — could not decode hotel details', { provider: 'mock' });
        }

        const scenario = this.scenarioFor(hotel);
        if (scenario === 'prebook_timeout') {
            throw new HotelProviderError('TIMEOUT', 'The mock supplier did not answer in time.', { provider: 'mock' });
        }
        if (scenario === 'sold_out') {
            throw new HotelProviderError('SOLD_OUT', UNAVAILABLE_MESSAGE, { provider: 'mock' });
        }

        const listed = stayTotal({
            hotel, room, plan, checkIn: ref.in, checkOut: ref.out, adults: ref.a, children: ref.c, currency: ref.cur,
        });
        const factor = scenario === 'price_up' ? 1.08 : scenario === 'price_down' ? 0.95 : 1;
        const gross  = roundMoney(listed * factor, ref.cur);
        const net    = roundMoney(gross * 0.9, ref.cur);

        const prebookRef = encode({ ...ref, k: 'prebook', net, gross });
        const terms = this.termsFor(plan, ref.in, gross, ref.cur, ref.in, ref.out);

        return {
            prebookRef,
            checkIn:         ref.in,
            checkOut:        ref.out,
            roomName:        room.name,
            roomSubstituted: input.roomName ? normalise(input.roomName) !== normalise(room.name) : false,
            price:           { net, gross, currency: ref.cur },
            surcharges:      [],
            cancellation:    terms,
            boardCode:       plan.boardCode,
            rooms:           [{ code: room.code, description: room.name, occupancyRefId: 1 }],
        };
    }

    async book(input: BookInput): Promise<ProviderBooking> {
        this.record('book', input);

        const ref   = this.ownsRef(input.prebookRef) ? decode<PrebookRef>(input.prebookRef, 'prebook') : null;
        const hotel = ref && MOCK_HOTELS.find((h) => h.id === ref.h);
        if (!ref || !hotel) {
            throw new HotelProviderError('INVALID_RATE', 'Invalid mock prebook reference', { provider: 'mock' });
        }
        if (!input.guests.length) {
            throw new HotelProviderError('REJECTED', 'At least one guest is required', { provider: 'mock' });
        }

        const scenario = this.scenarioFor(hotel);
        if (scenario === 'book_rejected') {
            throw new HotelProviderError('REJECTED', 'The mock supplier refused the booking.', { provider: 'mock' });
        }

        if (this.options.dedupeByClientRef) {
            const existing = this.findByClientRef(input.clientRef);
            if (existing) return this.toBooking(existing);
        }

        const reservation: Reservation = {
            clientRef:   input.clientRef,
            supplierRef: `MOCKSUP-${String(++this.sequence).padStart(6, '0')}`,
            ref,
            status:      'OK',
        };
        this.store.set(reservation.supplierRef, reservation);

        if (scenario === 'book_timeout') {
            // The reservation is made; only the answer is lost.
            throw new HotelProviderError('UNKNOWN_OUTCOME', 'The mock supplier did not answer in time.', { provider: 'mock' });
        }
        return this.toBooking(reservation);
    }

    async getBooking(ref: ProviderBookingRef): Promise<ProviderBooking | null> {
        this.record('getBooking', ref);
        const found = (ref.supplierRef && this.store.get(ref.supplierRef))
            || (ref.clientRef ? this.findByClientRef(ref.clientRef) : undefined);
        return found ? this.toBooking(found) : null;
    }

    async cancelBooking(input: CancelInput): Promise<ProviderCancellation> {
        this.record('cancelBooking', input);

        const found = (input.supplierRef && this.store.get(input.supplierRef))
            || (input.clientRef ? this.findByClientRef(input.clientRef) : undefined);
        if (!found) {
            throw new HotelProviderError('REJECTED', 'Booking not found', { provider: 'mock' });
        }
        if (found.status === 'CANCELLED') {
            throw new HotelProviderError('REJECTED', 'Booking is already cancelled', { provider: 'mock' });
        }

        const hotel = MOCK_HOTELS.find((h) => h.id === found.ref.h);
        const scenario = this.scenarioFor(hotel);
        if (scenario === 'cancel_rejected') {
            throw new HotelProviderError('REJECTED', 'The mock supplier will not cancel this booking.', { provider: 'mock' });
        }

        found.status = 'CANCELLED';
        if (scenario === 'cancel_timeout') {
            throw new HotelProviderError('UNKNOWN_OUTCOME', 'The mock supplier did not answer in time.', { provider: 'mock' });
        }

        const plan  = MOCK_RATE_PLANS.find((p) => p.code === found.ref.p);
        const terms = plan
            ? this.termsFor(plan, found.ref.in, found.ref.gross, found.ref.cur, found.ref.in, found.ref.out)
            : { refundable: false, penalties: [] };

        return {
            status:       'CANCELLED',
            clientRef:    found.clientRef,
            supplierRef:  found.supplierRef,
            refundAmount: this.refundFor(terms, found.ref.gross, found.ref.cur),
            currency:     found.ref.cur,
        };
    }

    // ── Internals ───────────────────────────────────────────────────────────

    private record(method: string, input: unknown): void {
        this.calls.push({ method, input });
    }

    private scenarioFor(hotel?: MockHotel): MockScenario {
        return this.override ?? this.options.scenario ?? hotel?.scenario ?? 'ok';
    }

    private findByClientRef(clientRef: string): Reservation | undefined {
        return [...this.store.values()].find((r) => r.clientRef === clientRef);
    }

    /** Missing dates default to a stay a month out, so a bare hotel lookup still quotes something. */
    private stayOf(s: { checkIn?: string; checkOut?: string; adults?: number; children?: number }): StayQuery {
        const checkIn  = s.checkIn  || addDays(new Date(this.now()).toISOString().slice(0, 10), 30);
        const checkOut = s.checkOut || addDays(checkIn, 2);
        return { checkIn, checkOut, adults: s.adults ?? 2, children: s.children ?? 0 };
    }

    private matchHotels(q: HotelSearchParams): MockHotel[] {
        if (q.hotelCode) return MOCK_HOTELS.filter((h) => h.id === String(q.hotelCode));

        const term = normalise(q.cityName ?? '');
        const byName = term
            ? MOCK_HOTELS.filter((h) => h.terms.some((t) => t === term || (term.length >= 3 && (term.includes(t) || t.includes(term)))))
            : [];

        let matched: readonly MockHotel[] = byName;
        if (!matched.length && typeof q.lat === 'number' && typeof q.lng === 'number') {
            matched = MOCK_HOTELS.filter((h) => distanceKm(q.lat as number, q.lng as number, h.lat, h.lng) <= 30);
        }

        if (Array.isArray(q.bbox) && q.bbox.length === 4) {
            const [minLng, minLat, maxLng, maxLat] = q.bbox;
            matched = matched.filter((h) => h.lng >= minLng && h.lng <= maxLng && h.lat >= minLat && h.lat <= maxLat);
        }
        return [...matched];
    }

    /** Every room × plan the party fits and the star rating allows, as flat rate options. */
    private ratesFor(hotel: MockHotel, stay: StayQuery): RoomType[] {
        const out: RoomType[] = [];
        for (const room of MOCK_ROOM_TYPES) {
            if (stay.adults > room.maxAdults) continue;
            for (const plan of MOCK_RATE_PLANS) {
                if (hotel.stars < plan.minStars) continue;
                out.push(this.toRoomType(hotel, room, plan, stay));
            }
        }
        return out;
    }

    private toRoomType(hotel: MockHotel, room: MockRoomType, plan: MockRatePlan, stay: StayQuery): RoomType {
        const currency = this.currency;
        const gross = stayTotal({
            hotel, room, plan, checkIn: stay.checkIn, checkOut: stay.checkOut,
            adults: stay.adults, children: stay.children, currency,
        });
        const net   = roundMoney(gross * 0.9, currency);
        const terms = this.termsFor(plan, stay.checkIn, gross, currency, stay.checkIn, stay.checkOut);
        const penalties = terms.penalties.map((p) => ({
            deadline: p.deadline, hoursBefore: p.hoursBefore ?? 0, penaltyType: p.type, currency: p.currency, value: p.value,
        }));
        const refundableTag = terms.refundable ? 'RFN' : 'NRFN';

        return {
            offerId: encode({
                v: 1, k: 'offer', h: hotel.id, r: room.code, p: plan.code,
                in: stay.checkIn, out: stay.checkOut, a: stay.adults, c: stay.children, cur: currency,
            }),
            roomName:      room.name,
            roomCode:      room.code,
            boardCode:     plan.boardCode,
            price:         gross,
            net,
            gross,
            currency,
            refundable:    terms.refundable,
            refundableTag,
            cancelPolicy:  { refundable: terms.refundable, cancelPenalties: penalties },
            rates: [{
                retailRate: { total: [{ amount: gross, currency }], currency },
                refundableTag,
                cancellationPolicies: penalties,
            }],
        };
    }

    private toListing(hotel: MockHotel, cheapest: RoomType, nightly: number): HotelListing {
        const h = hashOf(hotel.id);
        const rating = Math.round((7.5 + (h % 20) / 10) * 10) / 10;
        const reviews = 40 + (h % 860);
        const images = mockImages(hotel.id);
        return {
            hotelId:       hotel.id,
            id:            hotel.id,
            name:          hotel.name,
            price:         nightly,
            currency:      cheapest.currency,
            offerId:       cheapest.offerId,
            refundableTag: cheapest.refundableTag,
            starRating:    hotel.stars,
            images:        images.slice(0, 1),
            image:         images[0],
            lat:           hotel.lat,
            lng:           hotel.lng,
            coordinates:   { lat: hotel.lat, lng: hotel.lng },
            address:       hotel.address,
            location:      hotel.address,
            city:          hotel.city,
            country:       'PH',
            description:   hotel.description,
            amenities:     [...hotel.amenities],
            reviewRating:  rating,
            rating,
            reviews,
            reviewCount:   reviews,
            checkInTime:   hotel.checkInTime,
            checkOutTime:  hotel.checkOutTime,
            boardCode:     cheapest.boardCode,
            roomTypes:     [cheapest],
            provider:      'mock',
        };
    }

    /**
     * What cancelling costs, as the plan defines it. Deadlines are 18:00 in Manila (10:00Z) on
     * the day, so a "3 days before" penalty starts at 10:00Z three days before check-in.
     */
    private termsFor(
        plan: MockRatePlan, checkIn: string, gross: number, currency: string, from: string, to: string,
    ): CancellationTerms {
        const at = (daysBefore: number) =>
            new Date(Date.parse(`${checkIn}T10:00:00Z`) - daysBefore * 86_400_000).toISOString();
        const nightly = roundMoney(gross / nightsBetween(from, to), currency);

        switch (plan.policy) {
            case 'non_refundable':
                return { refundable: false, penalties: [] };
            case 'free_until_3d':
                return {
                    refundable: this.now() < Date.parse(at(3)),
                    penalties: [
                        { deadline: at(3), type: 'AMOUNT', value: nightly, currency, hoursBefore: 72 },
                        { deadline: at(1), type: 'AMOUNT', value: gross,   currency, hoursBefore: 24 },
                    ],
                };
            case 'tiered':
                return {
                    refundable: this.now() < Date.parse(at(7)),
                    penalties: [
                        { deadline: at(7), type: 'PERCENT', value: 50,  currency, hoursBefore: 168 },
                        { deadline: at(1), type: 'PERCENT', value: 100, currency, hoursBefore: 24 },
                    ],
                };
        }
    }

    /** The penalty in force now is the last one whose deadline has passed; before the first, none. */
    private refundFor(terms: CancellationTerms, gross: number, currency: string): number {
        const now = this.now();
        const inForce = [...terms.penalties]
            .filter((p) => Date.parse(p.deadline) <= now)
            .sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline))
            .pop();

        // No penalty has started: free if the rate was ever refundable, otherwise nothing.
        if (!inForce) return terms.penalties.length || terms.refundable ? gross : 0;

        const penalty = inForce.type === 'PERCENT' ? (gross * inForce.value) / 100 : inForce.value;
        return Math.max(0, roundMoney(gross - penalty, currency));
    }

    private toBooking(r: Reservation): ProviderBooking {
        const hotel = MOCK_HOTELS.find((h) => h.id === r.ref.h);
        const plan  = MOCK_RATE_PLANS.find((p) => p.code === r.ref.p);
        return {
            provider:     'mock',
            status:       r.status,
            clientRef:    r.clientRef,
            supplierRef:  r.supplierRef,
            hotelCode:    r.ref.h,
            hotelName:    hotel?.name,
            price:        { net: r.ref.net, gross: r.ref.gross, currency: r.ref.cur },
            cancellation: plan
                ? this.termsFor(plan, r.ref.in, r.ref.gross, r.ref.cur, r.ref.in, r.ref.out)
                : null,
        };
    }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.mock.test.ts`
Expected: PASS (all tests in the file).

If `cancels and refunds everything inside the free window` fails on the refund, re-check `refundFor`:
before the first penalty deadline, a refundable rate returns the whole `gross`; a non-refundable
one (no penalties, `refundable: false`) returns 0.

- [ ] **Step 5: Type-check**

Run: `& "$api\node_modules\.bin\tsc.cmd" -p "$api\tsconfig.json" --noEmit --declaration false`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```powershell
git -C $api add src/lib/hotels/providers/mock/MockHotelProvider.ts src/__tests__/hotelProvider.mock.test.ts
git -C $api commit -m @'
feat(hotels): MockHotelProvider

Deterministic in-process supplier with search, rates, prebook, book,
getBooking and cancel; nine scenarios (price change, sold out, timeouts,
rejections, unknown outcomes); a call log and a naive duplicate-booking
posture so double-submit bugs are visible.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 5: `TravelgateXProvider`

**Files:**
- Create: `src/lib/hotels/providers/travelgatex.provider.ts`
- Test: `src/__tests__/hotelProvider.travelgatex.test.ts`

The adapter calls the existing functions with the same arguments the service used to. Nothing in
`lib/hotels/search.ts` or `lib/hotels/travelgatex.ts` changes.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/hotelProvider.travelgatex.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/hotels/search', () => ({ runTgxSearch: vi.fn() }));
vi.mock('@/lib/hotels/travelgatex', () => ({ quoteTgx: vi.fn(), bookTgx: vi.fn(), cancelTgx: vi.fn() }));

import { runTgxSearch } from '@/lib/hotels/search';
import { quoteTgx, bookTgx, cancelTgx } from '@/lib/hotels/travelgatex';
import {
    TravelgateXProvider, classifyTgxFailure, parseTgxOptionToken, roomNamesMatch,
} from '@/lib/hotels/providers/travelgatex.provider';
import { HotelProviderError } from '@/lib/hotels/providers/types';
import type { HotelProviderErrorCode } from '@/lib/hotels/providers/types';

// `d` hotel · `b` check-in · `c` check-out · `h` guest nationality
const TOKEN = 'd10000352[b261110[c261112[hPH';

const provider = new TravelgateXProvider({ propagationDelayMs: 0, retryDelayMs: 0 });

const quote = (over: Record<string, unknown> = {}) => ({
    optionRefId: 'book-token',
    hotelCode:   '10000352',
    boardCode:   'BB',
    paymentType: 'MERCHANT',
    status:      'OK',
    price:       { net: 100, gross: 110, currency: 'USD' },
    surcharges:  [],
    rooms:       [{ code: 'DBL', description: 'Deluxe Room', occupancyRefId: 1 }],
    cancelPolicy: {
        refundable: true,
        cancelPenalties: [{ deadline: '2026-11-07T10:00:00Z', hoursBefore: 72, penaltyType: 'AMOUNT', currency: 'USD', value: 55 }],
    },
    ...over,
});

const freshRooms = (...names: string[]) => ({
    data: [{
        roomTypes: names.map((n, i) => ({
            offerId: `TGX:${TOKEN}-${i}`, roomName: n, boardCode: 'BB',
            rates: [{ _tgx: { id: `id-${i}`, token: `native-${i}` } }],
        })),
    }],
});

const prebookInput = { offerId: `TGX:${TOKEN}`, roomName: 'Deluxe Room', adults: 2, children: 0, currency: 'USD' };

async function codeOf(p: Promise<unknown>): Promise<HotelProviderErrorCode | undefined> {
    const err = await p.then(() => null, (e: unknown) => e);
    return err instanceof HotelProviderError ? err.code : undefined;
}

beforeEach(() => {
    vi.mocked(runTgxSearch).mockReset();
    vi.mocked(quoteTgx).mockReset();
    vi.mocked(bookTgx).mockReset();
    vi.mocked(cancelTgx).mockReset();
});

describe('TravelgateXProvider — identity', () => {
    it('owns TGX: references, cannot read bookings back, and holds no content', async () => {
        expect(provider.id).toBe('travelgatex');
        expect(provider.ownsRef('TGX:abc')).toBe(true);
        expect(provider.ownsRef('MOCK:abc')).toBe(false);
        expect(provider.capabilities).toEqual({ bookingRead: false, providesContent: false });
        expect(provider.getBooking).toBeUndefined();
        expect(await provider.getHotelDetails('10000352')).toBeNull();
    });
});

describe('TravelgateXProvider — search', () => {
    it('passes the query through untouched', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue({ data: [], totalCount: 0 } as never);
        const q = { cityName: 'Bangkok', checkin: '2026-11-10', checkout: '2026-11-12', adults: 2 };
        await provider.searchHotels(q);
        expect(runTgxSearch).toHaveBeenCalledWith(q);
    });

    it('leaves TravelgateX listings alone — search.ts already prices them per night', async () => {
        const result = { data: [{ id: '1', provider: undefined, price: 50 }], totalCount: 1 };
        vi.mocked(runTgxSearch).mockResolvedValue(result as never);
        const out = await provider.searchHotels({ cityName: 'Bangkok', checkin: '2026-11-10', checkout: '2026-11-12' });
        expect(out).toEqual(result);
        expect('allMappable' in out).toBe(false);
    });

    it('divides ETG listings by the nights, once, because they arrive as stay totals', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue({
            data:        [{ id: 'e1', provider: 'etg', price: 300 }, { id: 't1', price: 80 }],
            allMappable: [{ id: 'e1', provider: 'etg', price: 300 }],
            totalCount:  2,
        } as never);

        const out = await provider.searchHotels({ cityName: 'Palawan', checkin: '2026-11-10', checkout: '2026-11-13' });

        expect(out.data[0].price).toBe(100);   // 300 over three nights
        expect(out.data[1].price).toBe(80);    // untouched
        expect(out.allMappable?.[0].price).toBe(100);
    });
});

describe('TravelgateXProvider — rates', () => {
    it('asks for one hotel and returns its flat rate options', async () => {
        const roomTypes = [{ offerId: 'TGX:x', roomName: 'Room', price: 200 }];
        vi.mocked(runTgxSearch).mockResolvedValue({ data: [{ roomTypes }] } as never);

        const out = await provider.getRates('10000352', { checkIn: '2026-11-10', checkOut: '2026-11-12', adults: 2, children: 1 });

        expect(out).toEqual(roomTypes);
        expect(runTgxSearch).toHaveBeenCalledWith({
            hotelCode: '10000352', checkin: '2026-11-10', checkout: '2026-11-12',
            adults: 2, children: 1, currency: 'USD', guest_nationality: 'US',
        });
    });

    it('returns nothing when the supplier has nothing', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue({ data: [] } as never);
        expect(await provider.getRates('1', { checkIn: '2026-11-10', checkOut: '2026-11-12', adults: 2, children: 0 })).toEqual([]);
    });
});

describe('TravelgateXProvider — prebook', () => {
    it('re-reads the hotel, quotes the option and returns neutral terms', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue(freshRooms('Deluxe Room') as never);
        vi.mocked(quoteTgx).mockResolvedValue(quote() as never);

        const out = await provider.prebook(prebookInput);

        expect(runTgxSearch).toHaveBeenCalledWith({
            hotelCode: '10000352', checkin: '2026-11-10', checkout: '2026-11-12',
            adults: 2, children: 0, currency: 'USD', guest_nationality: 'PH',
        });
        expect(out).toEqual({
            prebookRef:      'TGX:book-token',
            checkIn:         '2026-11-10',
            checkOut:        '2026-11-12',
            roomName:        'Deluxe Room',
            roomSubstituted: false,
            price:           { net: 100, gross: 110, currency: 'USD' },
            surcharges:      [],
            cancellation: {
                refundable: true,
                penalties:  [{ deadline: '2026-11-07T10:00:00Z', type: 'AMOUNT', value: 55, currency: 'USD', hoursBefore: 72 }],
            },
            boardCode: 'BB',
            rooms:     [{ code: 'DBL', description: 'Deluxe Room', occupancyRefId: 1 }],
        });
    });

    it('tries the matching room first, and the option id before the native token', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue(freshRooms('Standard Room', 'Deluxe Room') as never);
        vi.mocked(quoteTgx).mockResolvedValue(quote() as never);

        await provider.prebook(prebookInput);

        // candidates are [Deluxe (matched), Standard]; the first token tried is its offer id
        expect(vi.mocked(quoteTgx).mock.calls[0][0]).toBe(`${TOKEN}-1`);
    });

    it('falls through the tokens of a room until one quotes', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue(freshRooms('Deluxe Room') as never);
        vi.mocked(quoteTgx)
            .mockRejectedValueOnce(new Error('TGX Quote errors: Option not found'))
            .mockRejectedValueOnce(new Error('TGX Quote errors: Option not found'))
            .mockResolvedValueOnce(quote({ optionRefId: 'native-quoted' }) as never);

        const out = await provider.prebook(prebookInput);

        expect(vi.mocked(quoteTgx).mock.calls.map((c) => c[0])).toEqual([`${TOKEN}-0`, 'id-0', 'native-0']);
        expect(out.prebookRef).toBe('TGX:native-quoted');
    });

    it('flags a substitution when the quoted room is not the one asked for', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue(freshRooms('Garden Bungalow') as never);
        vi.mocked(quoteTgx).mockResolvedValue(quote() as never);

        const out = await provider.prebook({ ...prebookInput, roomName: 'Deluxe Room' });

        expect(out.roomName).toBe('Garden Bungalow');
        expect(out.roomSubstituted).toBe(true);
    });

    it('is SOLD_OUT when the fresh search has no rooms', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue({ data: [{ roomTypes: [] }] } as never);
        const err = await provider.prebook(prebookInput).catch((e) => e);
        expect(err).toBeInstanceOf(HotelProviderError);
        expect(err.code).toBe('SOLD_OUT');
        expect(err.message).toBe('Room is no longer available for the selected dates');
    });

    it('is SOLD_OUT when no candidate can be quoted', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue(freshRooms('Deluxe Room') as never);
        vi.mocked(quoteTgx).mockRejectedValue(new Error('boom'));
        const err = await provider.prebook(prebookInput).catch((e) => e);
        expect(err.code).toBe('SOLD_OUT');
        expect(err.message).toBe('This room is currently unavailable for booking. Please try a different hotel or check back later.');
    });

    it('is NOT_PAYABLE_ONLINE when the supplier collects payment itself', async () => {
        vi.mocked(runTgxSearch).mockResolvedValue(freshRooms('Deluxe Room') as never);
        vi.mocked(quoteTgx).mockResolvedValue(quote({ paymentType: 'DIRECT' }) as never);
        const err = await provider.prebook(prebookInput).catch((e) => e);
        expect(err.code).toBe('NOT_PAYABLE_ONLINE');
        expect(err.message).toBe('This room is not available for online payment. Please contact support.');
    });

    it('is INVALID_RATE for a reference that is not its own or cannot be decoded', async () => {
        expect(await codeOf(provider.prebook({ ...prebookInput, offerId: 'MOCK:abc' }))).toBe('INVALID_RATE');
        expect(await codeOf(provider.prebook({ ...prebookInput, offerId: 'TGX:bad-token' }))).toBe('INVALID_RATE');
        expect(runTgxSearch).not.toHaveBeenCalled();
    });

    it('turns a supplier timeout during the fresh search into TIMEOUT', async () => {
        const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
        vi.mocked(runTgxSearch).mockRejectedValue(timeout);
        expect(await codeOf(provider.prebook(prebookInput))).toBe('TIMEOUT');
    });
});

describe('TravelgateXProvider — book', () => {
    const input = {
        prebookRef: 'TGX:book-token',
        clientRef:  'CG-ABC123',
        holder:     { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' },
        guests: [
            { firstName: 'Juan',  lastName: 'dela Cruz', age: 30, type: 'adult' as const },
            { firstName: 'Maria', lastName: 'dela Cruz', age: 8,  type: 'child' as const },
        ],
        stay: { adults: 1, children: 1, currency: 'USD' },
    };

    const bookedRaw = {
        status: 'OK', supplierRef: 'SUP-1', clientRef: 'CG-ABC123', hotelRef: 'H-1',
        hotelCode: '10000352', hotelName: 'The Grand',
        price: { net: 100, gross: 110, currency: 'USD' },
        cancelPolicy: { refundable: false, cancelPenalties: [] },
    };

    it('sends the token without its prefix, with pax names uppercased downstream', async () => {
        vi.mocked(bookTgx).mockResolvedValue(bookedRaw as never);
        await provider.book(input);
        expect(bookTgx).toHaveBeenCalledWith({
            quoteToken:      'book-token',
            clientReference: 'CG-ABC123',
            holder:          { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' },
            rooms: [{
                occupancyRefId: 1,
                paxes: [
                    { name: 'Juan',  surname: 'dela Cruz', age: 30 },
                    { name: 'Maria', surname: 'dela Cruz', age: 8 },
                ],
            }],
        });
    });

    it('returns the booking in neutral terms', async () => {
        vi.mocked(bookTgx).mockResolvedValue(bookedRaw as never);
        expect(await provider.book(input)).toEqual({
            provider: 'travelgatex', status: 'OK', clientRef: 'CG-ABC123', supplierRef: 'SUP-1',
            hotelRef: 'H-1', hotelCode: '10000352', hotelName: 'The Grand',
            price: { net: 100, gross: 110, currency: 'USD' },
            cancellation: { refundable: false, penalties: [] },
        });
    });

    it('re-quotes and re-books once when the option has expired', async () => {
        vi.mocked(bookTgx)
            .mockRejectedValueOnce(new Error('TGX Book errors: Option not found'))
            .mockResolvedValueOnce(bookedRaw as never);
        vi.mocked(runTgxSearch).mockResolvedValue(freshRooms('Deluxe Room') as never);
        vi.mocked(quoteTgx).mockResolvedValue(quote({ optionRefId: 'fresh-token' }) as never);

        const out = await provider.book({ ...input, prebookRef: `TGX:${TOKEN}` });

        expect(out.clientRef).toBe('CG-ABC123');
        expect(bookTgx).toHaveBeenCalledTimes(2);
        expect(vi.mocked(bookTgx).mock.calls[1][0].quoteToken).toBe('fresh-token');
    });

    it('does not retry a refusal', async () => {
        vi.mocked(bookTgx).mockRejectedValue(new Error('TGX Book errors: Holder name is invalid'));
        expect(await codeOf(provider.book(input))).toBe('REJECTED');
        expect(bookTgx).toHaveBeenCalledTimes(1);
    });

    it('does not retry — or call it a refusal — when the request may have landed', async () => {
        vi.mocked(bookTgx).mockRejectedValue(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));
        expect(await codeOf(provider.book(input))).toBe('UNKNOWN_OUTCOME');
        expect(bookTgx).toHaveBeenCalledTimes(1);
    });

    it('does not mistake a 503 that says "unavailable" for a vanished option', async () => {
        vi.mocked(bookTgx).mockRejectedValue(new Error('TravelgateX API error 503: Service unavailable'));
        expect(await codeOf(provider.book(input))).toBe('UNKNOWN_OUTCOME');
        expect(bookTgx).toHaveBeenCalledTimes(1);
    });

    it('is SOLD_OUT when the expired option cannot be re-quoted', async () => {
        vi.mocked(bookTgx).mockRejectedValue(new Error('TGX Book errors: Option not found'));
        vi.mocked(runTgxSearch).mockResolvedValue({ data: [{ roomTypes: [] }] } as never);
        const err = await provider.book({ ...input, prebookRef: `TGX:${TOKEN}` }).catch((e) => e);
        expect(err.code).toBe('SOLD_OUT');
        expect(err.message).toBe('Room is no longer available for these dates');
    });
});

describe('TravelgateXProvider — cancel', () => {
    it('cancels by client reference first and maps the answer', async () => {
        vi.mocked(cancelTgx).mockResolvedValue({
            status: 'CANCELLED', supplierRef: 'SUP-1', clientRef: 'CG-ABC123', refundAmount: 90, currency: 'USD',
        } as never);

        const out = await provider.cancelBooking({ clientRef: 'CG-ABC123', supplierRef: 'SUP-1', hotelCode: '10000352' });

        expect(cancelTgx).toHaveBeenCalledWith({
            clientReference: 'CG-ABC123', supplierReference: 'SUP-1', hotelCode: '10000352',
        });
        expect(out).toEqual({
            status: 'CANCELLED', supplierRef: 'SUP-1', clientRef: 'CG-ABC123', refundAmount: 90, currency: 'USD',
        });
    });

    it('classifies a refusal and a lost answer differently', async () => {
        vi.mocked(cancelTgx).mockRejectedValueOnce(new Error('Request not accepted by supplier'));
        expect(await codeOf(provider.cancelBooking({ clientRef: 'x' }))).toBe('UNKNOWN_OUTCOME');

        vi.mocked(cancelTgx).mockRejectedValueOnce(new Error('TGX Cancel errors: Booking already cancelled'));
        expect(await codeOf(provider.cancelBooking({ clientRef: 'x' }))).toBe('REJECTED');
    });
});

describe('classifyTgxFailure', () => {
    const cases: Array<[string, string, boolean, HotelProviderErrorCode]> = [
        ['vanished option',       'TGX Book errors: Option not found',               true,  'SOLD_OUT'],
        ['expired option',        'TGX Quote errors: option expired',                false, 'SOLD_OUT'],
        ['wrong field',           'TGX Quote errors: WRONG_FIELD',                   false, 'SOLD_OUT'],
        ['book refusal',          'TGX Book errors: Holder name is invalid',         true,  'REJECTED'],
        ['graphql refusal',       'TravelgateX GraphQL errors: bad input',           true,  'REJECTED'],
        ['client error',          'TravelgateX API error 400: bad request',          true,  'REJECTED'],
        ['server error (write)',  'TravelgateX API error 502: bad gateway',          true,  'UNKNOWN_OUTCOME'],
        ['server error (read)',   'TravelgateX API error 502: bad gateway',          false, 'UNAVAILABLE'],
        ['rate limited',          'TravelgateX API error 429: slow down',            false, 'UNAVAILABLE'],
        ['not confirmed',         'Booking not confirmed — status: CANCELLED',       true,  'REJECTED'],
        ['on request',            'Booking not confirmed — status: ON_REQUEST',      true,  'UNKNOWN_OUTCOME'],
        ['unknown (write)',       'something odd happened',                          true,  'UNKNOWN_OUTCOME'],
        ['unknown (read)',        'something odd happened',                          false, 'UNAVAILABLE'],
    ];

    it.each(cases)('%s', (_label, message, mutating, expected) => {
        expect(classifyTgxFailure(new Error(message), mutating).code).toBe(expected);
    });

    it.each([true, false])('timeouts: mutating=%s', (mutating) => {
        const err = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
        expect(classifyTgxFailure(err, mutating).code).toBe(mutating ? 'UNKNOWN_OUTCOME' : 'TIMEOUT');
    });

    it('returns an existing HotelProviderError unchanged', () => {
        const e = new HotelProviderError('REJECTED', 'x');
        expect(classifyTgxFailure(e, true)).toBe(e);
    });

    it('uses the fallback message when the error has none', () => {
        expect(classifyTgxFailure({}, true, 'fallback').message).toBe('fallback');
    });
});

describe('helpers lifted from the service', () => {
    it('decodes an option token', () => {
        expect(parseTgxOptionToken(TOKEN)).toEqual({
            hotelCode: '10000352', checkIn: '2026-11-10', checkOut: '2026-11-12', nationality: 'PH',
        });
        expect(parseTgxOptionToken('garbage')).toEqual({
            hotelCode: null, checkIn: null, checkOut: null, nationality: 'US',
        });
    });

    it('matches room names loosely', () => {
        expect(roomNamesMatch('Deluxe Room', 'deluxe room')).toBe(true);
        expect(roomNamesMatch('Deluxe Double Room - Breakfast', 'Deluxe Double Room')).toBe(true);
        expect(roomNamesMatch('Garden Bungalow', 'Deluxe Room')).toBe(false);
        expect(roomNamesMatch('', 'Deluxe Room')).toBe(false);
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.travelgatex.test.ts`
Expected: FAIL — cannot resolve `travelgatex.provider`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/hotels/providers/travelgatex.provider.ts
/**
 * TravelgateX (OTV) behind the provider contract.
 *
 * Everything supplier-specific that used to sit in `HotelsService` lives here: the option token
 * that encodes hotel, dates and nationality, the fresh search that has to precede a quote, the
 * pause OTV needs before an option can be valued, the several tokens one option can be quoted
 * under, and the retry when an option expired between prebook and book.
 *
 * It calls the existing functions with the arguments the service used to pass, so nothing in
 * `lib/hotels/search.ts` or `lib/hotels/travelgatex.ts` changes.
 */

import { runTgxSearch } from '@/lib/hotels/search';
import { quoteTgx, bookTgx, cancelTgx } from '@/lib/hotels/travelgatex';
import { nightsBetween } from '@/lib/hotels/nights';
import type { TgxCancelPolicy } from '@/types/hotels';
import {
    HotelProviderError,
    type BookInput,
    type CancelInput,
    type CancellationTerms,
    type HotelContent,
    type HotelProvider,
    type HotelSearchParams,
    type HotelSearchResult,
    type PrebookInput,
    type PrebookResult,
    type ProviderBooking,
    type ProviderCancellation,
    type ProviderCapabilities,
    type RoomType,
    type StayQuery,
} from './types';

const PREFIX = 'TGX:';

export interface TravelgateXProviderOptions {
    /** OTV needs a moment to propagate a freshly searched option into its valuation cache. */
    propagationDelayMs?: number;
    /** The same, before re-quoting an option that expired between prebook and book. */
    retryDelayMs?: number;
}

// ─── Helpers lifted from the service ──────────────────────────────────────────

/** An option token is a run of one-letter-keyed segments: `d` hotel, `b` in, `c` out, `h` nationality. */
export function parseTgxOptionToken(token: string): {
    hotelCode: string | null; checkIn: string | null; checkOut: string | null; nationality: string;
} {
    const segs: Record<string, string> = {};
    const separator = token.includes('!~|') ? '!~|' : '[';
    for (const seg of token.split(separator)) {
        if (seg.length > 1) segs[seg[0]] = seg.slice(1);
    }
    const parseYYMMDD = (v?: string): string | null => {
        if (!v || v.length !== 6) return null;
        return `20${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4, 6)}`;
    };
    return {
        hotelCode:   segs['d'] || null,
        checkIn:     parseYYMMDD(segs['b']),
        checkOut:    parseYYMMDD(segs['c']),
        nationality: segs['h'] || 'US',
    };
}

export function roomNamesMatch(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const na = normalize(a);
    const nb = normalize(b);
    if (!na || !nb) return false;
    if (na === nb || na.includes(nb) || nb.includes(na)) return true;
    const stopWords = new Set(['room', 'type', 'bed', 'with', 'and', 'the', 'for']);
    const wordsA = na.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
    const wordsB = new Set(nb.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w)));
    return wordsA.filter((w) => wordsB.has(w)).length >= 2;
}

function termsFromTgx(policy: TgxCancelPolicy | null | undefined): CancellationTerms | null {
    if (!policy) return null;
    return {
        refundable: policy.refundable ?? false,
        penalties: (policy.cancelPenalties ?? []).map((p) => ({
            deadline:    p.deadline,
            type:        p.penaltyType || 'AMOUNT',
            value:       p.value ?? 0,
            currency:    p.currency,
            hoursBefore: p.hoursBefore,
        })),
    };
}

// ─── Failure classification ───────────────────────────────────────────────────

const VANISHED_OPTION = /option not found|not found in|expired|unavailable|301|wrong_field/i;
const TIMED_OUT = /TimeoutError|AbortError|timed out|timeout|ETIMEDOUT|ECONNRESET|socket hang up|fetch failed|UND_ERR/i;

/**
 * Says what a TravelgateX failure means for the booking flow.
 *
 * `mutating` is the line that matters: a read that failed changed nothing, so it is safe to
 * retry; a booking or cancellation that failed *ambiguously* may have been done, and calling it a
 * refusal is how a guest ends up holding a room we refunded (ADR-0013, ADR-0026).
 *
 * Order is load-bearing. HTTP status and transport come first, so a 503 whose body happens to
 * say "unavailable" is not taken for a vanished option.
 */
export function classifyTgxFailure(
    err: unknown,
    mutating: boolean,
    fallbackMessage = 'Supplier request failed',
): HotelProviderError {
    if (err instanceof HotelProviderError) return err;

    const e = err as { name?: string; message?: string; cause?: { code?: string; name?: string } } | null | undefined;
    const message = e?.message || fallbackMessage;
    const meta = { provider: 'travelgatex' as const, cause: err };

    const http = /^TravelgateX API error (\d{3})/.exec(message);
    if (http) {
        const status = Number(http[1]);
        if (status >= 500 || status === 429) {
            return new HotelProviderError(mutating ? 'UNKNOWN_OUTCOME' : 'UNAVAILABLE', message, meta);
        }
        return new HotelProviderError(mutating ? 'REJECTED' : 'UNAVAILABLE', message, meta);
    }

    const transport = `${e?.name ?? ''} ${message} ${e?.cause?.code ?? ''} ${e?.cause?.name ?? ''}`;
    if (TIMED_OUT.test(transport)) {
        return new HotelProviderError(mutating ? 'UNKNOWN_OUTCOME' : 'TIMEOUT', message, meta);
    }

    const status = /Booking not confirmed — status: (\w+)/.exec(message)?.[1];
    if (status) {
        // ON_REQUEST means the hotel may still confirm; anything else is a refusal.
        return new HotelProviderError(/^(ON_?REQUEST|PENDING)$/i.test(status) ? 'UNKNOWN_OUTCOME' : 'REJECTED', message, meta);
    }

    if (VANISHED_OPTION.test(message)) {
        return new HotelProviderError('SOLD_OUT', message, meta);
    }

    if (/^TGX (Book|Quote|Cancel) errors:|^TravelgateX GraphQL errors:/i.test(message)) {
        return new HotelProviderError('REJECTED', message, meta);
    }

    return new HotelProviderError(mutating ? 'UNKNOWN_OUTCOME' : 'UNAVAILABLE', message, meta);
}

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

// ─── The provider ─────────────────────────────────────────────────────────────

export class TravelgateXProvider implements HotelProvider {
    readonly id           = 'travelgatex' as const;
    readonly displayName  = 'TravelgateX';
    readonly capabilities: ProviderCapabilities = { bookingRead: false, providesContent: false };

    private readonly propagationDelayMs: number;
    private readonly retryDelayMs: number;

    constructor(options: TravelgateXProviderOptions = {}) {
        this.propagationDelayMs = options.propagationDelayMs ?? 3000;
        this.retryDelayMs       = options.retryDelayMs ?? 1500;
    }

    ownsRef(ref: string): boolean {
        return typeof ref === 'string' && ref.startsWith(PREFIX);
    }

    /**
     * Listings arrive priced per night for TravelgateX results, which `search.ts` divides at the
     * source. ETG-sourced listings (province and country searches) arrive as stay totals, so they
     * are divided here — once, at the boundary — which is what lets every caller treat a
     * listing's price as the Nightly Rate without asking where it came from (ADR-0020).
     */
    async searchHotels(q: HotelSearchParams): Promise<HotelSearchResult> {
        const result = await runTgxSearch(q);
        const nights = nightsBetween(q.checkin, q.checkout);

        const perNight = (h: { provider?: string; price?: number }) =>
            h.provider === 'etg' ? { ...h, price: (h.price ?? 0) / nights } : h;

        return {
            ...result,
            data: Array.isArray(result.data) ? result.data.map(perNight) : result.data,
            ...(result.allMappable ? { allMappable: result.allMappable.map(perNight) } : {}),
        };
    }

    async getHotelDetails(_hotelId: string): Promise<HotelContent | null> {
        return null;
    }

    async getRates(hotelId: string, stay: StayQuery): Promise<RoomType[]> {
        const result = await runTgxSearch({
            hotelCode:         hotelId,
            checkin:           stay.checkIn,
            checkout:          stay.checkOut,
            adults:            stay.adults,
            children:          stay.children,
            currency:          stay.currency ?? 'USD',
            guest_nationality: stay.nationality ?? 'US',
        });
        return result?.data?.[0]?.roomTypes ?? [];
    }

    async prebook(input: PrebookInput): Promise<PrebookResult> {
        if (!this.ownsRef(input.offerId)) {
            throw new HotelProviderError('INVALID_RATE', 'This hotel is not available for instant online booking.', { provider: 'travelgatex' });
        }

        const staleToken = input.offerId.slice(PREFIX.length);
        const { hotelCode, checkIn, checkOut, nationality } = parseTgxOptionToken(staleToken);
        if (!hotelCode || !checkIn || !checkOut) {
            throw new HotelProviderError('INVALID_RATE', 'Invalid TGX offer ID — could not decode hotel details', { provider: 'travelgatex' });
        }

        console.log(`[prebook/tgx] Fresh search: hotel=${hotelCode} ${checkIn}→${checkOut} adults=${input.adults}`);
        let fresh: HotelSearchResult;
        try {
            fresh = await runTgxSearch({
                hotelCode,
                checkin:  checkIn,
                checkout: checkOut,
                adults:   input.adults,
                children: input.children,
                currency: input.currency,
                guest_nationality: nationality,
            });
        } catch (err) {
            throw classifyTgxFailure(err, false);
        }

        const freshRooms: any[] = fresh?.data?.[0]?.roomTypes || [];
        if (!freshRooms.length) {
            throw new HotelProviderError('SOLD_OUT', 'Room is no longer available for the selected dates', { provider: 'travelgatex' });
        }

        const wanted = input.roomName || '';
        const matched = wanted ? freshRooms.filter((r) => roomNamesMatch(r.roomName || r.roomType || '', wanted)) : [];
        const others  = wanted ? freshRooms.filter((r) => !roomNamesMatch(r.roomName || r.roomType || '', wanted)) : freshRooms;
        const candidates = [...matched, ...others].slice(0, 5);

        if (!candidates.length) {
            throw new HotelProviderError('SOLD_OUT', 'Room is no longer available for the selected dates', { provider: 'travelgatex' });
        }

        await sleep(this.propagationDelayMs);

        let optionQuote: Awaited<ReturnType<typeof quoteTgx>> | null = null;
        let quotedToken    = candidates[0]?.offerId?.slice(PREFIX.length) ?? staleToken;
        let successfulRoom = candidates[0];

        for (const room of candidates) {
            const offerId: string = room?.offerId || '';
            if (!offerId.startsWith(PREFIX)) continue;
            const optionId    = offerId.slice(PREFIX.length);
            const tgxId       = room?.rates?.[0]?._tgx?.id    || '';
            const nativeToken = room?.rates?.[0]?._tgx?.token || '';
            const tokensToTry = [...new Set([optionId, tgxId, nativeToken].filter(Boolean))];

            for (const token of tokensToTry) {
                console.log('[prebook/tgx] Quoting with token:', token.substring(0, 80));
                try {
                    optionQuote    = await quoteTgx(token);
                    quotedToken    = token;
                    successfulRoom = room;
                    break;
                } catch (e: any) {
                    console.warn('[prebook/tgx] Quote failed:', token.substring(0, 40), '—', e.message?.substring(0, 100));
                }
            }
            if (optionQuote) break;
        }

        if (!optionQuote) {
            throw new HotelProviderError(
                'SOLD_OUT',
                'This room is currently unavailable for booking. Please try a different hotel or check back later.',
                { provider: 'travelgatex' },
            );
        }

        if (optionQuote.paymentType && optionQuote.paymentType !== 'MERCHANT') {
            throw new HotelProviderError(
                'NOT_PAYABLE_ONLINE',
                'This room is not available for online payment. Please contact support.',
                { provider: 'travelgatex' },
            );
        }

        const bookToken      = optionQuote.optionRefId || quotedToken;
        const bookedRoomName = successfulRoom?.roomName || successfulRoom?.roomType || '';

        console.log(
            `[prebook/tgx] Success | book token: ${bookToken.substring(0, 60)} | room: ${bookedRoomName} | `
            + `price: ${optionQuote.price?.gross || optionQuote.price?.net} ${optionQuote.price?.currency}`,
        );

        return {
            prebookRef:      `${PREFIX}${bookToken}`,
            checkIn,
            checkOut,
            roomName:        bookedRoomName,
            roomSubstituted: wanted ? !roomNamesMatch(bookedRoomName, wanted) : false,
            price: {
                net:      optionQuote.price?.net   || 0,
                gross:    optionQuote.price?.gross || optionQuote.price?.net || 0,
                currency: optionQuote.price?.currency || input.currency,
            },
            surcharges:   optionQuote.surcharges || [],
            cancellation: termsFromTgx(optionQuote.cancelPolicy),
            boardCode:    optionQuote.boardCode || '',
            rooms:        optionQuote.rooms || [],
        };
    }

    async book(input: BookInput): Promise<ProviderBooking> {
        const quoteToken = input.prebookRef.startsWith(PREFIX) ? input.prebookRef.slice(PREFIX.length) : input.prebookRef;
        const holder = { firstName: input.holder.firstName, lastName: input.holder.lastName, email: input.holder.email };
        const rooms = [{
            occupancyRefId: 1,
            paxes: input.guests.map((g) => ({ name: g.firstName, surname: g.lastName, age: g.age })),
        }];

        try {
            return this.toBooking(await bookTgx({ quoteToken, clientReference: input.clientRef, holder, rooms }));
        } catch (firstErr) {
            const first = classifyTgxFailure(firstErr, true);
            // Only a vanished option is worth re-quoting. Anything else may have reached the supplier.
            if (first.code !== 'SOLD_OUT') throw first;
            console.log('[confirm] Token expired, retrying with fresh search...');
            return this.rebookWithFreshOption(quoteToken, input, holder, rooms);
        }
    }

    // `getBooking` is intentionally absent: TravelgateX cannot read a reservation back (ADR-0026).

    async cancelBooking(input: CancelInput): Promise<ProviderCancellation> {
        try {
            const r = await cancelTgx({
                clientReference:   input.clientRef,
                supplierReference: input.supplierRef,
                hotelCode:         input.hotelCode,
            });
            return {
                status:       'CANCELLED',
                supplierRef:  r.supplierRef,
                clientRef:    r.clientRef,
                refundAmount: r.refundAmount,
                currency:     r.currency,
            };
        } catch (err) {
            throw classifyTgxFailure(err, true, 'Cancellation failed');
        }
    }

    // ── Internals ───────────────────────────────────────────────────────────

    private async rebookWithFreshOption(
        staleToken: string,
        input: BookInput,
        holder: { firstName: string; lastName: string; email: string },
        rooms: Array<{ occupancyRefId: number; paxes: Array<{ name: string; surname: string; age: number }> }>,
    ): Promise<ProviderBooking> {
        const gone = () => new HotelProviderError('SOLD_OUT', 'Room is no longer available for these dates', { provider: 'travelgatex' });

        const { hotelCode, checkIn, checkOut, nationality } = parseTgxOptionToken(staleToken);
        if (!hotelCode || !checkIn || !checkOut) throw gone();

        const fresh = await runTgxSearch({
            hotelCode,
            checkin:  checkIn,
            checkout: checkOut,
            adults:   input.stay.adults,
            children: input.stay.children,
            currency: input.stay.currency,
            guest_nationality: nationality,
        }).catch(() => null);

        const freshRoom = fresh?.data?.[0]?.roomTypes?.[0];
        const freshOfferId: string = freshRoom?.offerId || '';
        if (!freshOfferId.startsWith(PREFIX)) throw gone();

        const freshOptionId = freshOfferId.slice(PREFIX.length);
        const freshNative   = freshRoom?.rates?.[0]?._tgx?.token || freshOptionId;

        await sleep(this.retryDelayMs);

        let freshToken: string | null = null;
        for (const token of [...new Set([freshNative, freshOptionId])]) {
            try {
                const q = await quoteTgx(token);
                freshToken = q.optionRefId || token;
                break;
            } catch { /* try the next token */ }
        }
        if (!freshToken) throw gone();

        try {
            return this.toBooking(await bookTgx({
                quoteToken: freshToken, clientReference: input.clientRef, holder, rooms,
            }));
        } catch (retryErr) {
            throw classifyTgxFailure(retryErr, true, 'TravelgateX booking failed after retry');
        }
    }

    private toBooking(b: Awaited<ReturnType<typeof bookTgx>>): ProviderBooking {
        return {
            provider:     'travelgatex',
            status:       b.status,
            clientRef:    b.clientRef,
            supplierRef:  b.supplierRef,
            hotelRef:     b.hotelRef,
            hotelCode:    b.hotelCode,
            hotelName:    b.hotelName,
            price:        b.price ? { net: b.price.net, gross: b.price.gross, currency: b.price.currency } : undefined,
            cancellation: termsFromTgx(b.cancelPolicy),
        };
    }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.travelgatex.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `& "$api\node_modules\.bin\tsc.cmd" -p "$api\tsconfig.json" --noEmit --declaration false`
Expected: exit 0.

- [ ] **Step 6: Commit**

```powershell
git -C $api add src/lib/hotels/providers/travelgatex.provider.ts src/__tests__/hotelProvider.travelgatex.test.ts
git -C $api commit -m @'
feat(hotels): TravelgateX adapter behind the provider contract

Lifts the supplier-specific half of prebook, book and cancel out of the
service: token decoding, the fresh search and quote loop, the expired-option
retry, and failure classification that separates a vanished option, a
refusal and an ambiguous outcome. ETG listings are priced per night here.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 6: Factory, config, `.env.example`

**Files:**
- Create: `src/lib/hotels/providers/factory.ts`
- Modify: `src/config.ts`
- Modify: `.env.example`
- Test: `src/__tests__/hotelProvider.factory.test.ts`, `src/__tests__/config.hotelProvider.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/hotelProvider.factory.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const cfg = vi.hoisted(() => ({
    HOTEL_PROVIDER: undefined as string | undefined,
    ALLOW_MOCK_HOTEL_PROVIDER: undefined as string | undefined,
    MOCK_HOTEL_SCENARIO: undefined as string | undefined,
    MOCK_HOTEL_CURRENCY: undefined as string | undefined,
}));
vi.mock('@/config', () => ({ config: cfg }));
vi.mock('@/lib/hotels/search', () => ({ runTgxSearch: vi.fn() }));
vi.mock('@/lib/hotels/travelgatex', () => ({ quoteTgx: vi.fn(), bookTgx: vi.fn(), cancelTgx: vi.fn() }));

import {
    createHotelProvider, getHotelProvider, getHotelProviderById, resolveProviderId, setHotelProviderForTests,
} from '@/lib/hotels/providers/factory';
import { MockHotelProvider } from '@/lib/hotels/providers/mock/MockHotelProvider';
import { TravelgateXProvider } from '@/lib/hotels/providers/travelgatex.provider';

beforeEach(() => {
    cfg.HOTEL_PROVIDER = undefined;
    cfg.ALLOW_MOCK_HOTEL_PROVIDER = undefined;
    cfg.MOCK_HOTEL_SCENARIO = undefined;
    cfg.MOCK_HOTEL_CURRENCY = undefined;
    setHotelProviderForTests(null);
});

describe('resolveProviderId', () => {
    it('defaults to TravelgateX', () => {
        expect(resolveProviderId({})).toBe('travelgatex');
    });

    it('accepts the ids it knows', () => {
        expect(resolveProviderId({ provider: 'mock', nodeEnv: 'development' })).toBe('mock');
        expect(resolveProviderId({ provider: 'travelgatex' })).toBe('travelgatex');
    });

    it('refuses an id it does not know, and says what it does', () => {
        expect(() => resolveProviderId({ provider: 'liteapi' })).toThrow(/Unknown HOTEL_PROVIDER "liteapi".*travelgatex, mock/);
    });

    it('refuses the mock in production unless explicitly allowed', () => {
        expect(() => resolveProviderId({ provider: 'mock', nodeEnv: 'production' })).toThrow(/refused in production/);
        expect(resolveProviderId({ provider: 'mock', nodeEnv: 'production', allowMock: 'true' })).toBe('mock');
        expect(resolveProviderId({ provider: 'travelgatex', nodeEnv: 'production' })).toBe('travelgatex');
    });
});

describe('createHotelProvider / getHotelProvider', () => {
    it('builds each provider', () => {
        expect(createHotelProvider('travelgatex')).toBeInstanceOf(TravelgateXProvider);
        expect(createHotelProvider('mock')).toBeInstanceOf(MockHotelProvider);
    });

    it('selects by configuration and reuses the instance', () => {
        expect(getHotelProvider()).toBeInstanceOf(TravelgateXProvider);
        expect(getHotelProvider()).toBe(getHotelProvider());

        cfg.HOTEL_PROVIDER = 'mock';
        expect(getHotelProviderById('mock')).toBeInstanceOf(MockHotelProvider);
    });

    it('passes the mock its scenario and currency from configuration', async () => {
        cfg.MOCK_HOTEL_SCENARIO = 'sold_out';
        cfg.MOCK_HOTEL_CURRENCY = 'PHP';
        const mock = createHotelProvider('mock') as MockHotelProvider;
        const rates = await mock.getRates('MOCK-MNL-001', { checkIn: '2026-11-10', checkOut: '2026-11-12', adults: 2, children: 0 });
        expect(rates[0].currency).toBe('PHP');
        await expect(mock.prebook({ offerId: rates[0].offerId, adults: 2, children: 0, currency: 'PHP' }))
            .rejects.toMatchObject({ code: 'SOLD_OUT' });
    });

    it('lets a test substitute and then restore the provider', () => {
        const fake = new MockHotelProvider();
        setHotelProviderForTests(fake);
        expect(getHotelProvider()).toBe(fake);
        expect(getHotelProviderById('travelgatex')).toBe(fake);

        setHotelProviderForTests(null);
        expect(getHotelProvider()).toBeInstanceOf(TravelgateXProvider);
    });
});
```

```ts
// src/__tests__/config.hotelProvider.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';

const BASE = {
    DATABASE_URL:       'postgresql://u:p@localhost:5432/db',
    JWT_SECRET:         'x',
    JWT_REFRESH_SECRET: 'x',
    COOKIE_SECRET:      'x',
    STRIPE_SECRET_KEY:  'sk_test_x',
};

async function loadConfig(env: Record<string, string>) {
    vi.resetModules();
    for (const [k, v] of Object.entries({ ...BASE, ...env })) vi.stubEnv(k, v);
    return (await import('@/config')).config;
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe('config — hotel provider', () => {
    it('defaults to travelgatex', async () => {
        const c = await loadConfig({ NODE_ENV: 'test' });
        expect(c.HOTEL_PROVIDER).toBe('travelgatex');
        expect(c.MOCK_HOTEL_SCENARIO).toBeUndefined();
    });

    it('accepts the mock with a scenario and currency', async () => {
        const c = await loadConfig({ NODE_ENV: 'development', HOTEL_PROVIDER: 'mock', MOCK_HOTEL_SCENARIO: 'price_up', MOCK_HOTEL_CURRENCY: 'PHP' });
        expect(c.HOTEL_PROVIDER).toBe('mock');
        expect(c.MOCK_HOTEL_SCENARIO).toBe('price_up');
        expect(c.MOCK_HOTEL_CURRENCY).toBe('PHP');
    });

    it('exits on an unknown provider or scenario', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const exit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as never);
        await expect(loadConfig({ HOTEL_PROVIDER: 'liteapi' })).rejects.toThrow('exit');
        await expect(loadConfig({ HOTEL_PROVIDER: 'mock', MOCK_HOTEL_SCENARIO: 'on_fire' })).rejects.toThrow('exit');
        expect(exit).toHaveBeenCalledWith(1);
    });

    it('exits when the mock is configured in production', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as never);
        await expect(loadConfig({ NODE_ENV: 'production', HOTEL_PROVIDER: 'mock' })).rejects.toThrow('exit');
    });

    it('lets production run the mock only when explicitly allowed', async () => {
        const c = await loadConfig({ NODE_ENV: 'production', HOTEL_PROVIDER: 'mock', ALLOW_MOCK_HOTEL_PROVIDER: 'true' });
        expect(c.HOTEL_PROVIDER).toBe('mock');
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.factory.test.ts src/__tests__/config.hotelProvider.test.ts`
Expected: FAIL — cannot resolve `factory`; config tests fail on missing fields.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/hotels/providers/factory.ts
/**
 * Which hotel supplier this process talks to.
 *
 * One environment value selects it (`HOTEL_PROVIDER`), and this is the only place that maps the
 * value to a class. Adding a supplier is a class implementing `HotelProvider`, a `case` here, and
 * an entry in the config enum — nothing in the booking flow changes.
 */

import { config } from '@/config';
import { MockHotelProvider } from './mock/MockHotelProvider';
import { TravelgateXProvider } from './travelgatex.provider';
import type { HotelProvider, ProviderId } from './types';

const IDS: readonly ProviderId[] = ['travelgatex', 'mock'];

function isProviderId(value: string): value is ProviderId {
    return (IDS as readonly string[]).includes(value);
}

/**
 * Validates the configured value. Kept pure so the production guard is testable: a mock
 * supplier in production would charge real cards for reservations that do not exist.
 */
export function resolveProviderId(input: { provider?: string; nodeEnv?: string; allowMock?: string }): ProviderId {
    const id = input.provider ?? 'travelgatex';
    if (!isProviderId(id)) {
        throw new Error(`Unknown HOTEL_PROVIDER "${id}". Expected one of: ${IDS.join(', ')}`);
    }
    if (id === 'mock' && input.nodeEnv === 'production' && input.allowMock !== 'true') {
        throw new Error(
            'HOTEL_PROVIDER=mock is refused in production: it would charge real cards for reservations '
            + 'that do not exist. Set ALLOW_MOCK_HOTEL_PROVIDER=true to override.',
        );
    }
    return id;
}

export function createHotelProvider(id: ProviderId): HotelProvider {
    switch (id) {
        case 'mock':
            return new MockHotelProvider({
                scenario: config.MOCK_HOTEL_SCENARIO,
                currency: config.MOCK_HOTEL_CURRENCY,
            });
        case 'travelgatex':
            return new TravelgateXProvider();
    }
}

const instances = new Map<ProviderId, HotelProvider>();
let override: HotelProvider | null = null;

/**
 * A specific provider, for acting on a booking made through it. A booking remembers its supplier,
 * so a cancellation goes back the way the booking came rather than to whatever is configured now.
 */
export function getHotelProviderById(id: ProviderId): HotelProvider {
    if (override) return override;
    resolveProviderId({ provider: id, nodeEnv: process.env.NODE_ENV, allowMock: config.ALLOW_MOCK_HOTEL_PROVIDER });
    let instance = instances.get(id);
    if (!instance) {
        instance = createHotelProvider(id);
        instances.set(id, instance);
    }
    return instance;
}

/** The provider this environment is configured for. */
export function getHotelProvider(): HotelProvider {
    if (override) return override;
    const id = resolveProviderId({
        provider:  config.HOTEL_PROVIDER,
        nodeEnv:   process.env.NODE_ENV,
        allowMock: config.ALLOW_MOCK_HOTEL_PROVIDER,
    });
    return getHotelProviderById(id);
}

export function isKnownProviderId(value: unknown): value is ProviderId {
    return typeof value === 'string' && isProviderId(value);
}

/** Pass `null` to restore normal selection. Tests only. */
export function setHotelProviderForTests(provider: HotelProvider | null): void {
    override = provider;
    instances.clear();
}
```

Edit `src/config.ts` — add the import, the fields, and the boot guard:

```ts
// src/config.ts — add below `import { z } from 'zod';`
import { MOCK_SCENARIOS } from '@/lib/hotels/providers/mock/scenarios';
```

```ts
// src/config.ts — inside z.object({ ... }), after MAPBOX_TOKEN
    MAPBOX_TOKEN: z.string().optional(),

    // Which hotel supplier this process talks to. `mock` never calls a supplier, and is refused
    // in production unless ALLOW_MOCK_HOTEL_PROVIDER=true.
    HOTEL_PROVIDER: z.enum(['travelgatex', 'mock']).default('travelgatex'),
    ALLOW_MOCK_HOTEL_PROVIDER: z.string().optional(),
    MOCK_HOTEL_SCENARIO: z.enum(MOCK_SCENARIOS).optional(),
    MOCK_HOTEL_CURRENCY: z.string().length(3).optional(),
    // `log` writes the email to the console instead of sending it. Defaults to `log` when the
    // hotel provider is the mock, and to `resend` otherwise.
    EMAIL_TRANSPORT: z.enum(['resend', 'log']).optional(),
```
(the existing last field `MAPBOX_TOKEN: z.string().optional()` has no trailing comma; the edit adds one.)

```ts
// src/config.ts — after the `if (!parsed.success) { ... }` block, before `export const config`
if (
    parsed.data.NODE_ENV === 'production'
    && parsed.data.HOTEL_PROVIDER === 'mock'
    && parsed.data.ALLOW_MOCK_HOTEL_PROVIDER !== 'true'
) {
    console.error('❌ HOTEL_PROVIDER=mock is refused in production: it would charge real cards for reservations that do not exist.');
    console.error('   Set ALLOW_MOCK_HOTEL_PROVIDER=true to override.');
    process.exit(1);
}
```

Edit `.env.example` — append:

```
# ── Hotel provider ────────────────────────────────────────────────────
# travelgatex (default) | mock. The mock never calls a supplier; it is refused in
# production unless ALLOW_MOCK_HOTEL_PROVIDER=true.
HOTEL_PROVIDER=travelgatex
# MOCK_HOTEL_SCENARIO=ok          # ok|price_up|price_down|sold_out|prebook_timeout|book_rejected|book_timeout|cancel_rejected|cancel_timeout
# MOCK_HOTEL_CURRENCY=USD         # USD|PHP|KRW|EUR
# EMAIL_TRANSPORT=log             # log|resend — log is the default when HOTEL_PROVIDER=mock
```

- [ ] **Step 4: Run them to see them pass**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.factory.test.ts src/__tests__/config.hotelProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git -C $api add src/lib/hotels/providers/factory.ts src/config.ts .env.example src/__tests__/hotelProvider.factory.test.ts src/__tests__/config.hotelProvider.test.ts
git -C $api commit -m @'
feat(hotels): select the hotel provider with HOTEL_PROVIDER

Factory over travelgatex and mock, a bookings-remember-their-supplier lookup,
and a production guard in both the factory and the config so a mock supplier
can never take a real payment.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 7: Contract suite across providers

**Files:**
- Test: `src/__tests__/hotelProvider.contract.test.ts`

One suite, run against every provider. A new provider is acceptable when this passes against it.

- [ ] **Step 1: Write the test**

```ts
// src/__tests__/hotelProvider.contract.test.ts
import { describe, it, expect, vi } from 'vitest';

// A fake TravelgateX world, so the real adapter can be held to the same contract as the mock.
const world = vi.hoisted(() => {
    const TOKEN = 'd10000352[b261110[c261112[hKR';
    const gross = 220;
    const option = (suffix: string) => ({
        offerId: `TGX:${TOKEN}-${suffix}`, roomName: 'Deluxe Room', roomCode: 'DBL', boardCode: 'BB',
        price: gross, net: 200, gross, currency: 'USD', refundable: true, refundableTag: 'RFN',
        cancelPolicy: { refundable: true, cancelPenalties: [{ deadline: '2026-11-07T10:00:00Z', hoursBefore: 72, penaltyType: 'AMOUNT', currency: 'USD', value: 110 }] },
        rates: [{ _tgx: { id: `id-${suffix}`, token: `native-${suffix}` } }],
    });
    return { TOKEN, gross, option };
});

vi.mock('@/lib/hotels/search', () => ({
    runTgxSearch: vi.fn(async (p: { hotelCode?: string }) => p.hotelCode
        ? { data: [{ roomTypes: [world.option('a'), world.option('b')] }] }
        : {
            data: [{
                hotelId: '10000352', id: '10000352', name: 'The Grand', price: world.gross / 2, currency: 'USD',
                offerId: `TGX:${world.TOKEN}-a`, roomTypes: [world.option('a')],
            }],
            totalCount: 1,
        }),
}));

vi.mock('@/lib/hotels/travelgatex', () => ({
    quoteTgx: vi.fn(async () => ({
        optionRefId: 'book-token', hotelCode: '10000352', boardCode: 'BB', paymentType: 'MERCHANT', status: 'OK',
        price: { net: 200, gross: 220, currency: 'USD' }, surcharges: [],
        rooms: [{ code: 'DBL', description: 'Deluxe Room', occupancyRefId: 1 }],
        cancelPolicy: { refundable: true, cancelPenalties: [] },
    })),
    bookTgx: vi.fn(async (i: { clientReference: string }) => ({
        status: 'OK', supplierRef: 'SUP-1', clientRef: i.clientReference, hotelCode: '10000352', hotelName: 'The Grand',
        price: { net: 200, gross: 220, currency: 'USD' }, cancelPolicy: { refundable: true, cancelPenalties: [] },
    })),
    cancelTgx: vi.fn(async (i: { clientReference?: string }) => ({
        status: 'CANCELLED', supplierRef: 'SUP-1', clientRef: i.clientReference, refundAmount: 220, currency: 'USD',
    })),
}));

import { MockHotelProvider } from '@/lib/hotels/providers/mock/MockHotelProvider';
import { TravelgateXProvider } from '@/lib/hotels/providers/travelgatex.provider';
import { HotelProviderError, type HotelProvider } from '@/lib/hotels/providers/types';
import { nightsBetween } from '@/lib/hotels/nights';

interface Fixture {
    name:        string;
    make:        () => HotelProvider;
    hotelId:     string;
    cityName:    string;
    foreignRef:  string;
}

const STAY = { checkIn: '2026-11-10', checkOut: '2026-11-12', adults: 2, children: 0 };

const FIXTURES: Fixture[] = [
    {
        name: 'MockHotelProvider',
        make: () => new MockHotelProvider({ now: () => Date.parse('2026-10-14T00:00:00Z') }),
        hotelId: 'MOCK-MNL-001', cityName: 'Manila', foreignRef: 'TGX:d1[b261110[c261112[hKR',
    },
    {
        name: 'TravelgateXProvider',
        make: () => new TravelgateXProvider({ propagationDelayMs: 0, retryDelayMs: 0 }),
        hotelId: '10000352', cityName: 'Bangkok', foreignRef: 'MOCK:abc',
    },
];

describe.each(FIXTURES)('HotelProvider contract — $name', (fx) => {
    const holder = { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' };
    const guests = [{ firstName: 'Juan', lastName: 'dela Cruz', age: 30, type: 'adult' as const }];

    async function firstRate(p: HotelProvider) {
        const rates = await p.getRates(fx.hotelId, STAY);
        expect(rates.length).toBeGreaterThan(0);
        return rates[0];
    }

    it('declares an id, a display name and capabilities', () => {
        const p = fx.make();
        expect(p.id).toBeTruthy();
        expect(p.displayName).toBeTruthy();
        expect(typeof p.capabilities.bookingRead).toBe('boolean');
        expect(typeof p.capabilities.providesContent).toBe('boolean');
        expect(typeof p.getBooking === 'function').toBe(p.capabilities.bookingRead);
    });

    it('searches: owned offers, priced per night, consistent with the cheapest rate', async () => {
        const p = fx.make();
        const out = await p.searchHotels({
            cityName: fx.cityName, checkin: STAY.checkIn, checkout: STAY.checkOut, adults: 2, children: 0,
        });
        expect(out.data.length).toBeGreaterThan(0);

        const nights = nightsBetween(STAY.checkIn, STAY.checkOut);
        for (const listing of out.data) {
            expect(p.ownsRef(listing.offerId)).toBe(true);
            expect(listing.price).toBeGreaterThan(0);
            expect(typeof listing.currency).toBe('string');
            expect(listing.price).toBeCloseTo(listing.roomTypes[0].gross / nights, 2);
        }
    });

    it('returns rates the provider owns, priced as a stay total', async () => {
        const p = fx.make();
        for (const rate of await p.getRates(fx.hotelId, STAY)) {
            expect(p.ownsRef(rate.offerId)).toBe(true);
            expect(rate.gross).toBeGreaterThan(0);
            expect(rate.price).toBe(rate.gross);
            expect(['RFN', 'NRFN']).toContain(rate.refundableTag);
        }
    });

    it('prebooks a rate it listed', async () => {
        const p = fx.make();
        const rate = await firstRate(p);
        const q = await p.prebook({ offerId: rate.offerId, roomName: rate.roomName, adults: 2, children: 0, currency: 'USD' });

        expect(p.ownsRef(q.prebookRef)).toBe(true);
        expect(q.price.gross).toBeGreaterThan(0);
        expect(q.price.gross).toBeGreaterThanOrEqual(q.price.net);
        expect(q.price.currency).toBeTruthy();
        expect(q.checkIn).toBe(STAY.checkIn);
        expect(q.checkOut).toBe(STAY.checkOut);
        expect(Array.isArray(q.surcharges)).toBe(true);
        expect(Array.isArray(q.rooms)).toBe(true);
    });

    it('refuses to prebook a reference that is not its own', async () => {
        const p = fx.make();
        const err = await p.prebook({ offerId: fx.foreignRef, adults: 2, children: 0, currency: 'USD' }).catch((e) => e);
        expect(err).toBeInstanceOf(HotelProviderError);
        expect(err.code).toBe('INVALID_RATE');
    });

    it('books under our reference and can cancel it', async () => {
        const p = fx.make();
        const rate = await firstRate(p);
        const q = await p.prebook({ offerId: rate.offerId, roomName: rate.roomName, adults: 2, children: 0, currency: 'USD' });

        const b = await p.book({ prebookRef: q.prebookRef, clientRef: 'CG-CONTRACT', holder, guests, stay: { adults: 1, children: 0, currency: 'USD' } });
        expect(b.provider).toBe(p.id);
        expect(b.clientRef).toBe('CG-CONTRACT');
        expect(b.supplierRef).toBeTruthy();

        const c = await p.cancelBooking({ clientRef: 'CG-CONTRACT', supplierRef: b.supplierRef });
        expect(c.status).toBe('CANCELLED');
    });

    it('reads a booking back when it says it can', async () => {
        const p = fx.make();
        if (!p.capabilities.bookingRead || !p.getBooking) return;

        const rate = await firstRate(p);
        const q = await p.prebook({ offerId: rate.offerId, adults: 2, children: 0, currency: 'USD' });
        await p.book({ prebookRef: q.prebookRef, clientRef: 'CG-READBACK', holder, guests, stay: { adults: 1, children: 0, currency: 'USD' } });

        expect((await p.getBooking({ clientRef: 'CG-READBACK' }))?.clientRef).toBe('CG-READBACK');
        expect(await p.getBooking({ clientRef: 'CG-NEVER-BOOKED' })).toBeNull();
    });
});
```

- [ ] **Step 2: Run it**

Run: `npm --prefix $api run test -- src/__tests__/hotelProvider.contract.test.ts`
Expected: PASS for both providers.

- [ ] **Step 3: Commit**

```powershell
git -C $api add src/__tests__/hotelProvider.contract.test.ts
git -C $api commit -m @'
test(hotels): one contract suite for every hotel provider

Runs the same assertions against the mock and the TravelgateX adapter (over a
fake supplier). A new provider is acceptable when this passes against it.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 8: Route `HotelsService` through the provider

**Files:**
- Create: `src/services/hotelProviderErrors.ts`
- Modify: `src/services/hotels.service.ts`
- Test: `src/__tests__/hotels.service.mockProvider.test.ts` (new); existing
  `hotels.service.test.ts` and `hotels.service.property.test.ts` must stay green **unmodified**.

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/hotels.service.mockProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config', () => ({ config: { RESEND_API_KEY: '', SITE_URL: 'https://cheapestgo.com' } }));
vi.mock('@/lib/hotels/search', () => ({ runTgxSearch: vi.fn() }));
vi.mock('@/lib/hotels/travelgatex', () => ({ quoteTgx: vi.fn(), bookTgx: vi.fn(), cancelTgx: vi.fn() }));
vi.mock('@/lib/hotels/etgContent', () => ({ ensureEtgContent: vi.fn() }));
vi.mock('@/lib/redis', () => ({ redis: {} }));

vi.mock('@/lib/stripe', () => ({
    stripe: {
        paymentIntents: { create: vi.fn(), retrieve: vi.fn(), capture: vi.fn(), cancel: vi.fn(), update: vi.fn(), search: vi.fn() },
        refunds: { create: vi.fn() },
    },
}));

vi.mock('@/repositories/hotels.repository', () => ({
    HotelsRepository: vi.fn(function (this: any) {
        this.recordSearchDemand   = vi.fn().mockResolvedValue(undefined);
        this.findHotelContent     = vi.fn();
        this.findHotelReviews     = vi.fn().mockResolvedValue(null);
        this.findHotelReviewItems = vi.fn().mockResolvedValue([]);
        this.savePrebookQuote     = vi.fn().mockResolvedValue(undefined);
        this.savePolicySnapshot   = vi.fn().mockResolvedValue(undefined);
        this.findPolicySnapshot   = vi.fn().mockResolvedValue(null);
        this.openRefund           = vi.fn().mockResolvedValue('refund-log-1');
        this.closeRefund          = vi.fn().mockResolvedValue(undefined);
        this.findPrebookQuote     = vi.fn();
    }),
}));

vi.mock('@/lib/prisma', () => ({
    prisma: { bookings: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } },
}));

vi.mock('@/middleware/error.middleware', () => ({
    AppError: class AppError extends Error {
        constructor(public status: number, message: string, public code: string, public details?: Record<string, unknown>) {
            super(message);
        }
    },
}));

import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { runTgxSearch } from '@/lib/hotels/search';
import { bookTgx } from '@/lib/hotels/travelgatex';
import { HotelsService } from '@/services/hotels.service';
import { MockHotelProvider } from '@/lib/hotels/providers/mock/MockHotelProvider';

const NOW  = Date.parse('2026-10-14T00:00:00Z');
const STAY = { checkIn: '2026-11-10', checkOut: '2026-11-12' };
const HOTEL = 'MOCK-MNL-001';
const USER = 'user-1';
const PI   = 'pi_mock_1';

let mock: MockHotelProvider;
let service: HotelsService;

beforeEach(() => {
    vi.clearAllMocks();
    mock    = new MockHotelProvider({ now: () => NOW });
    service = new HotelsService(mock);

    vi.mocked(prisma.bookings.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.bookings.create).mockResolvedValue({ id: 'row-1' } as never);
    vi.mocked(prisma.bookings.update).mockResolvedValue({} as never);
});

async function preBook(hotelId = HOTEL, board = 'BB') {
    const rates = await mock.getRates(hotelId, { ...STAY, adults: 2, children: 0 });
    const rate  = rates.find((r) => r.roomName === 'Standard Double Room' && r.boardCode === board)!;
    return service.preBook({ offerId: rate.offerId, roomName: rate.roomName, adults: 2, children: 0, currency: 'USD' });
}

function authorised() {
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({
        id: PI, status: 'requires_capture', amount: 26400, currency: 'usd',
        metadata: { userId: USER, bookingReference: 'CG-MOCK01' },
    } as never);
    vi.mocked(stripe.paymentIntents.capture).mockResolvedValue({} as never);
    vi.mocked(stripe.paymentIntents.update).mockResolvedValue({} as never);
}

const confirmParams = (prebookId: string) => ({
    paymentIntentId: PI, userId: USER, prebookId,
    holder: { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' },
    guests: [{ firstName: 'Juan', lastName: 'dela Cruz' }, { firstName: 'Maria', lastName: 'dela Cruz' }],
    propertyName: 'Bayside Grand Manila', roomName: 'Standard Double Room',
    checkIn: STAY.checkIn, checkOut: STAY.checkOut, adults: 2, children: 0, currency: 'USD',
});

describe('HotelsService with the mock provider — search and details', () => {
    it('searches the mock, never the supplier', async () => {
        const out: any = await service.search({
            destination: 'Manila', checkIn: STAY.checkIn, checkOut: STAY.checkOut, adults: 2,
        });
        expect(out.data.map((h: any) => h.id)).toContain(HOTEL);
        expect(runTgxSearch).not.toHaveBeenCalled();
    });

    it('serves a property from the provider when the provider owns the content', async () => {
        const out: any = await service.getProperty(HOTEL, { ...STAY, adults: 2, children: 0 });

        expect((service as any).repo.findHotelContent).not.toHaveBeenCalled();
        expect(out.content).toMatchObject({
            hotel_id: HOTEL, name: 'Bayside Grand Manila', city: 'Manila', star_rating: 5,
            check_in_time: '14:00', check_out_time: '12:00',
        });
        expect(out.content.images).toHaveLength(4);
        // per night: BB standard is 240 for two nights
        const standard = out.rooms.find((r: any) => r.name === 'Standard Double Room');
        expect(standard.rates.find((r: any) => r.boardCode === 'BB').price).toBe(120);
        expect(runTgxSearch).not.toHaveBeenCalled();
    });

    it('is a 404 for a hotel the provider does not know', async () => {
        await expect(service.getProperty('MOCK-NOPE', { ...STAY, adults: 2, children: 0 }))
            .rejects.toMatchObject({ status: 404 });
    });
});

describe('HotelsService with the mock provider — prebook', () => {
    it('quotes, records the quote, and answers in the same shape as before', async () => {
        const out: any = await preBook();

        expect(out.success).toBe(true);
        expect(out.data.prebookId.startsWith('MOCK:')).toBe(true);
        expect(out.data.provider).toBe('mock');
        expect(out.data.price).toEqual({ subtotal: 216, taxes: 24, total: 240 });
        expect(out.data.currency).toBe('USD');
        expect(out.data.boardCode).toBe('BB');
        expect(out.data.cancellationPolicies.refundableTag).toBe('RFN');
        expect(out.data.cancellationPolicies.cancelPolicyInfos[0]).toMatchObject({ amount: 0, type: 'AMOUNT' });
        expect(out.data.display).toMatchObject({ currency: 'USD', total: 240, converted: false });

        expect((service as any).repo.savePrebookQuote).toHaveBeenCalledWith(expect.objectContaining({
            prebookId: out.data.prebookId, gross: 240, net: 216, currency: 'USD',
            roomName: 'Standard Double Room', checkIn: STAY.checkIn, checkOut: STAY.checkOut,
        }));
    });

    it('re-prices under price_up, and the recorded quote is the new price', async () => {
        mock.setScenario('price_up');
        const out: any = await preBook();
        expect(out.data.price.total).toBeCloseTo(259.2, 2);
        expect((service as any).repo.savePrebookQuote).toHaveBeenCalledWith(expect.objectContaining({ gross: 259.2 }));
    });

    it('answers 409 UNAVAILABLE when the room has gone', async () => {
        await expect(preBook('MOCK-QA-SOLDOUT')).rejects.toMatchObject({ status: 409, code: 'UNAVAILABLE' });
    });

    it('answers 503 UPSTREAM_UNAVAILABLE when the supplier does not answer', async () => {
        await expect(preBook('MOCK-QA-PBTIMEOUT')).rejects.toMatchObject({ status: 503, code: 'UPSTREAM_UNAVAILABLE' });
    });

    it('answers 400 INVALID_OFFER for another provider\'s reference', async () => {
        await expect(service.preBook({ offerId: 'TGX:d1[b261110[c261112[hKR' }))
            .rejects.toMatchObject({ status: 400, code: 'INVALID_OFFER' });
    });
});

describe('HotelsService with the mock provider — confirm', () => {
    it('books once, captures, records the booking under the mock supplier', async () => {
        authorised();
        const q: any = await preBook();

        const out: any = await service.confirmBooking(confirmParams(q.data.prebookId));

        expect(out.success).toBe(true);
        expect(out.data.bookingId).toBe('CG-MOCK01');
        expect(mock.calls.filter((c) => c.method === 'book')).toHaveLength(1);
        expect(mock.reservations[0]).toMatchObject({ clientRef: 'CG-MOCK01', status: 'OK' });
        expect(stripe.paymentIntents.capture).toHaveBeenCalledWith(PI, expect.anything());
        expect(prisma.bookings.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ booking_id: 'CG-MOCK01', provider: 'mock', status: 'confirmed' }),
        });
        expect(bookTgx).not.toHaveBeenCalled();
    });

    it('passes both guests to the supplier with the ages it always used', async () => {
        authorised();
        const q: any = await preBook();
        await service.confirmBooking({ ...confirmParams(q.data.prebookId), children: 1, guests: [
            { firstName: 'Juan', lastName: 'dela Cruz' }, { firstName: 'Maria', lastName: 'dela Cruz' }, { firstName: 'Pepe', lastName: 'dela Cruz' },
        ] });

        const booked = mock.calls.find((c) => c.method === 'book')!.input as { guests: Array<{ age: number; type: string }> };
        expect(booked.guests.map((g) => [g.type, g.age])).toEqual([['adult', 30], ['adult', 30], ['child', 10]]);
    });

    it('does not capture or record anything when the supplier refuses', async () => {
        authorised();
        const q: any = await preBook('MOCK-QA-BOOKFAIL');

        const out: any = await service.confirmBooking(confirmParams(q.data.prebookId));

        expect(out).toMatchObject({ success: false, providerConfirmed: false });
        expect(out.error).toMatch(/refused/i);
        expect(stripe.paymentIntents.capture).not.toHaveBeenCalled();
        expect(prisma.bookings.create).not.toHaveBeenCalled();
        expect(mock.reservations).toHaveLength(0);
    });

    it('does not book twice for one payment', async () => {
        authorised();
        const q: any = await preBook();
        await service.confirmBooking(confirmParams(q.data.prebookId));

        vi.mocked(prisma.bookings.findFirst).mockResolvedValue({
            booking_id: 'CG-MOCK01', status: 'confirmed', total_price: 264, currency: 'USD',
        } as never);
        const again: any = await service.confirmBooking(confirmParams(q.data.prebookId));

        expect(again.success).toBe(true);
        expect(mock.calls.filter((c) => c.method === 'book')).toHaveLength(1);
    });
});

describe('HotelsService with the mock provider — cancel', () => {
    const row = {
        booking_id: 'CG-MOCK01', user_id: USER, payment_intent_id: PI, status: 'confirmed',
        provider: 'mock', provider_metadata: { hotelCode: HOTEL, supplierRef: 'MOCKSUP-000001' },
        property_name: 'Bayside Grand Manila', total_price: 264, currency: 'USD',
        check_in: new Date('2026-11-10T00:00:00Z'),
    };

    it('cancels at the supplier the booking was made with', async () => {
        authorised();
        const q: any = await preBook();
        await service.confirmBooking(confirmParams(q.data.prebookId));

        vi.mocked(prisma.bookings.findFirst).mockResolvedValue(row as never);
        vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({ status: 'requires_capture', amount: 26400 } as never);
        vi.mocked(stripe.paymentIntents.cancel).mockResolvedValue({} as never);

        const out: any = await service.cancelBooking({ bookingRef: 'CG-MOCK01', userId: USER, paymentIntentId: PI });

        expect(out.success).toBe(true);
        expect(mock.reservations[0].status).toBe('CANCELLED');
        expect(prisma.bookings.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { booking_id: 'CG-MOCK01' },
        }));
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm --prefix $api run test -- src/__tests__/hotels.service.mockProvider.test.ts`
Expected: FAIL — `HotelsService` takes no provider and still calls the supplier functions.

- [ ] **Step 3: Write the implementation**

Create the error mapper:

```ts
// src/services/hotelProviderErrors.ts
import { AppError } from '@/middleware/error.middleware';
import { HotelProviderError } from '@/lib/hotels/providers/types';

/**
 * A supplier failure, as the response the UI maps to a message.
 *
 * Codes that existed before the provider seam keep their status and code (`INVALID_OFFER`,
 * `UNAVAILABLE`, `NON_MERCHANT`); the new ones follow the convention `nearby` already uses for
 * an upstream that did not answer. Anything that is not a provider error is returned unchanged.
 */
export function toAppError(err: unknown): unknown {
    if (!(err instanceof HotelProviderError)) return err;

    switch (err.code) {
        case 'INVALID_RATE':
            return new AppError(400, err.message, 'INVALID_OFFER');
        case 'SOLD_OUT':
            return new AppError(409, err.message, 'UNAVAILABLE');
        case 'NOT_PAYABLE_ONLINE':
            return new AppError(409, err.message, 'NON_MERCHANT');
        case 'PRICE_CHANGED':
            return new AppError(409, err.message, 'PRICE_CHANGED', {
                serverPrice: err.details.currentTotal,
                currency:    err.details.currency,
            });
        case 'TIMEOUT':
        case 'UNAVAILABLE':
            return new AppError(503, err.message, 'UPSTREAM_UNAVAILABLE');
        case 'REJECTED':
        case 'UNKNOWN_OUTCOME':
            return new AppError(502, err.message, 'UPSTREAM_ERROR');
    }
}
```

Edit `src/services/hotels.service.ts`.

**(a) Imports.** Replace the supplier imports:

```ts
// before
import { runTgxSearch as searchHotels } from '@/lib/hotels/search';
import { quoteTgx, bookTgx, cancelTgx, fetchAmenitiesByDestination } from '@/lib/hotels/travelgatex';
```
```ts
// after
import { fetchAmenitiesByDestination } from '@/lib/hotels/travelgatex';
import { getHotelProvider, getHotelProviderById, isKnownProviderId } from '@/lib/hotels/providers/factory';
import { toPrebookPolicyWire, toStoredPolicyWire } from '@/lib/hotels/providers/cancellationPolicy';
import type {
    BookGuest, HotelContent as ProviderHotelContent, HotelProvider, PrebookResult, ProviderBooking,
} from '@/lib/hotels/providers/types';
import { toAppError } from '@/services/hotelProviderErrors';
```

**(b) Delete the three TGX helpers** (`parseTgxOptionToken`, `roomNamesMatch`,
`normalizeTgxCancelPolicy`) — they now live in the adapter and `cancellationPolicy.ts`. Delete from
the `parseTgxOptionToken` declaration to the closing brace of `normalizeTgxCancelPolicy`; leave the
`// … ETG hotel/info helpers` section that follows.

**(c) Constructor and provider accessor** — replace the class header:

```ts
// before
export class HotelsService {
    private repo = new HotelsRepository();
```
```ts
// after
export class HotelsService {
    private repo = new HotelsRepository();

    /** Injected in tests; otherwise whichever provider the environment selects, resolved on use. */
    constructor(private readonly injectedProvider?: HotelProvider) {}

    private get provider(): HotelProvider {
        return this.injectedProvider ?? getHotelProvider();
    }

    /** The provider a booking was made through — which may not be the one configured now. */
    private providerFor(recorded: unknown): HotelProvider {
        if (this.injectedProvider) return this.injectedProvider;
        return isKnownProviderId(recorded) ? getHotelProviderById(recorded) : getHotelProvider();
    }
```

**(d) `search()`** — replace the supplier call:

```ts
// before
        const results = await searchHotels({
            cityName:    params.destination,
            checkin:     params.checkIn,
            checkout:    params.checkOut,
            adults:      params.adults,
            children:    params.children,
            countryCode: params.countryCode,
            currency:    params.currency,
            rooms:       params.rooms,
        } as any);
```
```ts
// after
        const results = await this.provider.searchHotels({
            cityName:    params.destination,
            checkin:     params.checkIn,
            checkout:    params.checkOut,
            adults:      params.adults,
            children:    params.children,
            countryCode: params.countryCode,
            currency:    params.currency,
            rooms:       params.rooms,
        });
```

**(e) `getProperty()`** — replace the top of the method, up to the 404:

```ts
// before
        const [content, reviews, reviewItems, tgxResult] = await Promise.all([
            this.repo.findHotelContent(hotelId),
            this.repo.findHotelReviews(hotelId),
            this.repo.findHotelReviewItems(hotelId, 20),
            searchHotels({
                hotelCode:         hotelId,
                checkin:           stay.checkIn,
                checkout:          stay.checkOut,
                adults:            stay.adults ?? 2,
                children:          stay.children ?? 0,
                currency:          'USD',
                guest_nationality: 'US',
            }).catch(() => null),
        ]);
        if (!content) throw new AppError(404, 'Property not found', 'NOT_FOUND');
```
```ts
// after
        const provider = this.provider;
        const providerOwnsContent = provider.capabilities.providesContent;

        const [dbContent, reviews, reviewItems, rawTypesOrNull] = await Promise.all([
            providerOwnsContent ? Promise.resolve(null) : this.repo.findHotelContent(hotelId),
            this.repo.findHotelReviews(hotelId),
            this.repo.findHotelReviewItems(hotelId, 20),
            provider.getRates(hotelId, {
                checkIn:     stay.checkIn,
                checkOut:    stay.checkOut,
                adults:      stay.adults ?? 2,
                children:    stay.children ?? 0,
                currency:    'USD',
                nationality: 'US',
            }).catch(() => null),
        ]);

        const providerContent = providerOwnsContent ? await provider.getHotelDetails(hotelId) : null;
        const content = dbContent ?? (providerContent ? toContentRow(providerContent) : null);
        if (!content) throw new AppError(404, 'Property not found', 'NOT_FOUND');
```
then, further down in the same method:

```ts
// before
        let effectiveReviews: typeof reviews = reviews;
        if (!effectiveReviews) {
```
```ts
// after
        let effectiveReviews: typeof reviews = reviews;
        // Provider content has no Google enrichment cache to read or fill.
        if (!effectiveReviews && !providerContent) {
```
```ts
// before
        const rawTypes = tgxResult?.data?.[0]?.roomTypes ?? [];
```
```ts
// after
        const rawTypes = rawTypesOrNull ?? [];
```
```ts
// before
        const etg = await withTimeout(ensureEtgContent(hotelId, content), 8_000);
```
```ts
// after
        const etg = providerContent ? null : await withTimeout(ensureEtgContent(hotelId, content), 8_000);
```

Add the content mapper above the class (below `withTimeout`):

```ts
/**
 * A provider's content in the shape a catalog row has, so the property response is built one way
 * whichever source the hotel came from. Only the fields the property page reads are filled.
 */
function toContentRow(c: ProviderHotelContent) {
    return {
        hotel_id:       c.hotelId,
        name:           c.name,
        address:        c.address,
        city:           c.city,
        country:        c.country,
        lat:            c.lat,
        lng:            c.lng,
        star_rating:    c.starRating,
        description:    c.description,
        images:         c.images,
        amenities:      c.amenities,
        check_in_time:  c.checkInTime,
        check_out_time: c.checkOutTime,
        room_groups: null, amenity_groups: null, metapolicy_struct: null, metapolicy_extra_info: null,
        important_information: null, ratehawk_hid: null, content_source: 'provider', last_attempt_at: null,
    } as any;
}
```

**(f) `preBook()`** — replace the whole method body (from the `startsWith('TGX:')` check to the
`return`) with:

```ts
    async preBook(params: {
        offerId:   string;
        currency?: string;
        roomName?: string;
        adults?:   number;
        children?: number;
    }) {
        const adults   = params.adults   ?? 2;
        const children = params.children ?? 0;
        const currency = params.currency || 'USD';

        let quote: PrebookResult;
        try {
            quote = await this.provider.prebook({
                offerId: params.offerId, roomName: params.roomName, adults, children, currency,
            });
        } catch (err) {
            throw toAppError(err);
        }

        // Record what the supplier quoted. createPayment charges from this row rather than from
        // the client's payload, so the Stripe base comes from the supplier instead of the
        // browser. Failing to record must not fail the prebook: checkout rejects a prebookId it
        // has no quote for, so the worst case is the customer retrying.
        const prebookId = quote.prebookRef;
        try {
            await this.repo.savePrebookQuote({
                prebookId,
                net:       quote.price.net,
                gross:     quote.price.gross,
                currency:  quote.price.currency,
                roomName:  quote.roomName || null,
                checkIn:   quote.checkIn,
                checkOut:  quote.checkOut,
                expiresAt: new Date(Date.now() + PREBOOK_QUOTE_TTL_MS),
            });
        } catch (persistErr) {
            console.error('[prebook] Failed to persist quote — checkout will reject this prebookId:', persistErr);
        }

        // What the customer is shown, produced here rather than in the browser (see ADR-0021).
        const quotedSubtotal  = quote.price.net;
        const quotedTotal     = quote.price.gross;
        const quotedTaxes     = quote.price.gross - quote.price.net;
        const quotedCurrency  = quote.price.currency.toUpperCase();
        const displayCurrency = String(params.currency || quotedCurrency).toUpperCase();

        let display: Record<string, unknown> | undefined;
        try {
            // Rates are needed to convert the room, and — because the fee's flat part is
            // quoted in USD — whenever the display currency is not USD at all.
            const needsRates = quotedCurrency !== displayCurrency || displayCurrency !== 'USD';
            const convert = makeStrictConverter(needsRates ? await new ExchangeRatesService().getLiveRates() : null);
            const to = (n: number) => Math.round(convert(n, quotedCurrency, displayCurrency) * 100) / 100;
            const total = to(quotedTotal);
            const fee   = hotelServiceFee(total, displayCurrency, convert);
            display = {
                currency:     displayCurrency,
                subtotal:     to(quotedSubtotal),
                taxes:        to(quotedTaxes),
                total,
                serviceFee:   fee.serviceFee,
                chargedTotal: fee.chargedTotal,
                converted:    quotedCurrency !== displayCurrency,
            };
        } catch (fxErr: any) {
            // Left absent: the checkout says prices are still being confirmed rather than
            // showing a total the charge might not match.
            console.warn('[prebook] display conversion unavailable:', fxErr?.message);
        }

        return {
            success: true,
            data: {
                prebookId,
                provider: this.provider.id,
                price: {
                    subtotal: quotedSubtotal,
                    taxes:    quotedTaxes,
                    total:    quotedTotal,
                },
                ...(display ? { display } : {}),
                surcharges:           quote.surcharges,
                currency:             quote.price.currency,
                cancellationPolicies: toPrebookPolicyWire(quote.cancellation),
                boardCode:            quote.boardCode,
                rooms:                quote.rooms,
                ...(quote.roomSubstituted && quote.roomName && { roomSubstituted: true, substitutedRoomName: quote.roomName }),
            },
        };
    }
```

**(g) `confirmBooking()`** — replace from `const quoteToken = …` through the `bookingStatus`
line. Keep `paidReference` / `existing` above it untouched.

```ts
// before (start)
        const quoteToken     = params.prebookId.startsWith('TGX:') ? params.prebookId.slice(4) : params.prebookId;
        const adults         = params.adults   ?? 2;
```
```ts
// after (the whole replaced region)
        const adults         = params.adults   ?? 2;
        const children       = params.children ?? 0;
        const currency       = params.currency || 'USD';
        const guests         = params.guests   || [];
        // The reference the supplier files the reservation under, and the one a cancellation has
        // to quote. It comes from the PaymentIntent, so the booking and the charge carry the same
        // reference; a booking taken before references existed falls back to a fresh one.
        const clientReference = paidReference
            ?? mintBookingReference(canonicalBrandName(process.env.BRAND_NAME ?? process.env.NEXT_PUBLIC_BRAND_NAME));

        const adultGuests: BookGuest[] = Array(adults).fill(null).map((_, i) => ({
            firstName: guests[i]?.firstName || params.holder.firstName,
            lastName:  guests[i]?.lastName  || params.holder.lastName,
            age:       30,
            type:      'adult' as const,
        }));
        const childGuests: BookGuest[] = Array(children).fill(null).map((_, i) => ({
            firstName: guests[adults + i]?.firstName || `Child${i + 1}`,
            lastName:  guests[adults + i]?.lastName  || params.holder.lastName,
            age:       (guests[adults + i] as any)?.age || 10,
            type:      'child' as const,
        }));

        let booking: ProviderBooking;
        try {
            booking = await this.provider.book({
                prebookRef: params.prebookId,
                clientRef:  clientReference,
                holder:     params.holder,
                guests:     [...adultGuests, ...childGuests],
                stay:       { adults, children, currency },
            });
        } catch (err: any) {
            console.error('[confirm] supplier booking failed:', err?.code ?? '', err?.message);
            return { success: false, providerConfirmed: false, error: err?.message || 'Booking failed' };
        }

        const clientRef = booking.clientRef;
        if (!clientRef) {
            return { success: false, error: `Booking failed — no reference returned from ${this.provider.displayName}` };
        }

        const bookingId     = clientRef;
        const supplierRef   = booking.supplierRef;
        const hotelCode     = booking.hotelCode ?? null;
        const rawStatus     = (booking.status || 'confirmed').toLowerCase();
        const bookingStatus = (['confirmed', 'pending'].includes(rawStatus) ? rawStatus : 'confirmed') as string;
```
and delete the old statements this replaces (`clientReference`, `adultPaxes`, `childPaxes`,
`tgxResult` try/catch with the retry, and the `const booking = tgxResult; … bookingStatus` lines).
Then update the lines that read the old TGX-shaped `booking`:

```ts
// before
        const tgxPrice = booking.price?.gross || booking.price?.net || 0;
```
```ts
// after
        const tgxPrice = booking.price?.gross || booking.price?.net || 0; // supplier cost
```
```ts
// before
        const isRefundable     = hasPrebookPolicy
            ? (prebookPolicy.refundableTag === 'RFN' || prebookPolicy.refundableTag === 'REFUNDABLE')
            : booking.cancelPolicy?.refundable === true;
        const storedCancelPolicy = hasPrebookPolicy ? prebookPolicy : (booking.cancelPolicy ? {
            refundableTag: isRefundable ? 'RFN' : 'NRFN',
            cancelPolicyInfos: (booking.cancelPolicy.cancelPenalties || []).map((p: any) => ({
                cancelTime: p.deadline, amount: p.value ?? 0, currency: p.currency || storedCurrency, type: p.penaltyType || 'AMOUNT',
            })),
        } : null);
```
```ts
// after
        const isRefundable     = hasPrebookPolicy
            ? (prebookPolicy.refundableTag === 'RFN' || prebookPolicy.refundableTag === 'REFUNDABLE')
            : booking.cancellation?.refundable === true;
        const storedCancelPolicy = hasPrebookPolicy
            ? prebookPolicy
            : toStoredPolicyWire(booking.cancellation, storedCurrency);
```
```ts
// before
                    provider:          'travelgatex',
```
```ts
// after
                    provider:          booking.provider,
```

**(h) `cancelBooking()`** — replace the supplier call, which stays inside the same `try`/`catch`:

```ts
// before
                await cancelTgx({
                    clientReference:   bookingRef,
                    supplierReference: meta?.supplierRef,
                    hotelCode:         cancelHotelCode,
                });
```
```ts
// after
                await this.providerFor(booking.provider).cancelBooking({
                    clientRef:   bookingRef,
                    supplierRef: meta?.supplierRef,
                    hotelCode:   cancelHotelCode,
                });
```

- [ ] **Step 4: Run the new test and the two existing suites**

Run: `npm --prefix $api run test -- src/__tests__/hotels.service.mockProvider.test.ts src/__tests__/hotels.service.test.ts src/__tests__/hotels.service.property.test.ts`
Expected: all PASS. The two existing files must pass **without edits**.

- [ ] **Step 5: Type-check**

Run: `& "$api\node_modules\.bin\tsc.cmd" -p "$api\tsconfig.json" --noEmit --declaration false`
Expected: exit 0. Fix unused imports (`HotelContent as ProviderHotelContent` is used; remove any
that are not).

- [ ] **Step 6: Commit**

```powershell
git -C $api add src/services/hotelProviderErrors.ts src/services/hotels.service.ts src/__tests__/hotels.service.mockProvider.test.ts
git -C $api commit -m @'
refactor(hotels): route search, rates, prebook, book and cancel through the provider

HotelsService no longer imports a supplier. Wire shapes are unchanged and the
existing service suites pass untouched. Provider content is served when the
provider owns it; a cancellation goes back through the supplier the booking
was made with.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 9: Route the search stream through the provider, and divide once

**Files:**
- Modify: `src/controllers/hotels.controller.ts`
- Test: `src/__tests__/hotels.searchStream.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/hotels.searchStream.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('@/config', () => ({ config: { GOOGLE_PLACES_API_KEY: '' } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/cityAliases', () => ({ CITY_ALIASES: {} }));
vi.mock('@/lib/google/places', () => ({ getPlaceDetails: vi.fn(), geocode: vi.fn() }));
vi.mock('@/lib/hotels/property', () => ({ resolveStayDates: vi.fn() }));
vi.mock('@/lib/hotels/travelgatex', () => ({ resolveTgxDestinationCode: vi.fn() }));
vi.mock('@/lib/hotels/contentPatches', () => ({ fetchHotelContentPatches: vi.fn() }));
vi.mock('@/lib/hotels/search', () => ({ getInstantHotelCatalog: vi.fn(), runTgxSearch: vi.fn() }));
vi.mock('@/services/hotels.service', () => ({ HotelsService: class {} }));
vi.mock('@/services/destinations.service', () => ({ DestinationsService: class {} }));
vi.mock('@/middleware/error.middleware', () => ({
    AppError: class extends Error { constructor(public status: number, m: string, public code?: string) { super(m); } },
}));

import { getInstantHotelCatalog } from '@/lib/hotels/search';
import { fetchHotelContentPatches } from '@/lib/hotels/contentPatches';
import { HotelsController } from '@/controllers/hotels.controller';
import { setHotelProviderForTests } from '@/lib/hotels/providers/factory';
import type { HotelProvider } from '@/lib/hotels/providers/types';

function fakeRes() {
    const chunks: string[] = [];
    const res: any = {
        writableEnded: false,
        setHeader: vi.fn(), flushHeaders: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(),
        write: vi.fn((s: string) => { chunks.push(s); return true; }),
        end: vi.fn(() => { res.writableEnded = true; }),
    };
    const events = () => chunks.join('').split('\n\n').filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, '')));
    return { res, events };
}

function fakeReq(body: Record<string, unknown>) {
    const req: any = new EventEmitter();
    req.body = body;
    return req;
}

function fakeProvider(over: { providesContent: boolean; data: any[] }) {
    const searchHotels = vi.fn().mockResolvedValue({ data: over.data, allMappable: [], totalCount: over.data.length });
    const provider = {
        id: 'mock', displayName: 'mock', capabilities: { bookingRead: false, providesContent: over.providesContent },
        ownsRef: () => true, searchHotels,
    } as unknown as HotelProvider;
    return { provider, searchHotels };
}

const BODY = { destination: 'Manila', checkIn: '2026-11-10', checkOut: '2026-11-13', adults: 2 }; // three nights

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInstantHotelCatalog).mockResolvedValue([]);
    vi.mocked(fetchHotelContentPatches).mockResolvedValue(new Map());
});

describe('HotelsController.searchStream', () => {
    it('sends listing prices exactly as the provider priced them — per night, not divided again', async () => {
        const { provider, searchHotels } = fakeProvider({
            providesContent: false,
            data: [{ hotelId: 'H1', id: 'H1', name: 'The Grand', price: 100, currency: 'USD', images: ['x'], image: 'x', lat: 14.5, lng: 121 }],
        });
        setHotelProviderForTests(provider);

        const { res, events } = fakeRes();
        await new HotelsController().searchStream(fakeReq(BODY), res);

        const hotels = events().filter((e) => e.type === 'hotels').flatMap((e) => e.data);
        expect(hotels.map((h: any) => h.price)).toEqual([100]);
        expect(searchHotels).toHaveBeenCalledTimes(1);
        expect(events().some((e) => e.type === 'done')).toBe(true);
        expect(res.end).toHaveBeenCalled();
    });

    it('asks the provider, with the traveller\'s stay', async () => {
        const { provider, searchHotels } = fakeProvider({ providesContent: false, data: [] });
        setHotelProviderForTests(provider);

        await new HotelsController().searchStream(fakeReq(BODY), fakeRes().res);

        expect(searchHotels).toHaveBeenCalledWith(expect.objectContaining({
            cityName: 'Manila', checkin: '2026-11-10', checkout: '2026-11-13', adults: 2,
        }));
    });

    it('skips the database catalog and ETG pictures when the provider owns the content', async () => {
        const { provider } = fakeProvider({
            providesContent: true,
            data: [{ hotelId: 'M1', id: 'M1', name: 'Mock', price: 50, currency: 'USD', images: [], image: '', lat: 14.5, lng: 121 }],
        });
        setHotelProviderForTests(provider);

        const { res, events } = fakeRes();
        await new HotelsController().searchStream(fakeReq(BODY), res);

        expect(getInstantHotelCatalog).not.toHaveBeenCalled();
        expect(fetchHotelContentPatches).not.toHaveBeenCalled();
        expect(events().filter((e) => e.type === 'hotels').flatMap((e) => e.data)).toHaveLength(1);
    });

    it('still reads the catalog and fills missing pictures for a supplier that has none of its own', async () => {
        const { provider } = fakeProvider({
            providesContent: false,
            data: [{ hotelId: 'H2', id: 'H2', name: 'No Photo', price: 70, currency: 'USD', images: [], image: '', lat: 14.5, lng: 121 }],
        });
        setHotelProviderForTests(provider);

        await new HotelsController().searchStream(fakeReq(BODY), fakeRes().res);

        expect(getInstantHotelCatalog).toHaveBeenCalledTimes(1);
        expect(fetchHotelContentPatches).toHaveBeenCalledWith(['H2'], 8_000);
    });

    it('reports a supplier that did not answer, with the catalog left alone', async () => {
        const { provider, searchHotels } = fakeProvider({ providesContent: false, data: [] });
        const err = Object.assign(new Error('no answer'), { name: 'UnansweredSearchError' });
        searchHotels.mockRejectedValue(err);
        setHotelProviderForTests(provider);

        const { res, events } = fakeRes();
        await new HotelsController().searchStream(fakeReq(BODY), res);

        const done = events().find((e) => e.type === 'done');
        expect(done).toMatchObject({ tgxFailed: true, tgxUnanswered: true });
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm --prefix $api run test -- src/__tests__/hotels.searchStream.test.ts`
Expected: FAIL — the controller still calls `runTgxSearch`, divides the price, and reads the catalog
for a content-owning provider.

- [ ] **Step 3: Write the implementation**

Edit `src/controllers/hotels.controller.ts`:

```ts
// before
import { nightsBetween } from '@/lib/hotels/nights';
import { fetchHotelContentPatches } from '@/lib/hotels/contentPatches';
import { resolveTgxDestinationCode } from '@/lib/hotels/travelgatex';
import { getInstantHotelCatalog, runTgxSearch } from '@/lib/hotels/search';
```
```ts
// after
import { fetchHotelContentPatches } from '@/lib/hotels/contentPatches';
import { resolveTgxDestinationCode } from '@/lib/hotels/travelgatex';
import { getInstantHotelCatalog } from '@/lib/hotels/search';
import { getHotelProvider } from '@/lib/hotels/providers/factory';
```

In `searchStream`, immediately after `res.flushHeaders();` / the `emit` and `closed` definitions
(before `try {`), add:

```ts
        // The provider decides where hotels and their content come from. A supplier with no
        // content of its own (TravelgateX) is shown through the catalog first; one that is the
        // authority (the mock) is not, because catalog rows it cannot price would only be
        // removed again a moment later.
        const provider   = getHotelProvider();
        const useCatalog = !provider.capabilities.providesContent;
```

Phase 1 (catalog) — gate the read:

```ts
// before
            const catalogHotels = await Promise.race([
                getInstantHotelCatalog(catalogParams),
                new Promise<any[]>(resolve => setTimeout(() => resolve([]), 8000)),
            ]);
```
```ts
// after
            const catalogHotels: any[] = useCatalog
                ? await Promise.race([
                    getInstantHotelCatalog(catalogParams),
                    new Promise<any[]>(resolve => setTimeout(() => resolve([]), 8000)),
                ])
                : [];
```

Phase 2 — the supplier call, in both places it appears (`runTgxSearch({…})` and
`runTgxSearch(searchArgs)`):

```ts
// before
            const tgxResult = await runTgxSearch({
// after
            const tgxResult = await provider.searchHotels({
```
```ts
// before
                const second = await runTgxSearch(searchArgs)
// after
                const second = await provider.searchHotels(searchArgs)
```

Delete the second division. Replace:

```ts
// before
            /**
             * Per night, because that is what a card says.
             * … (the long comment) …
             */
            const stayNights = nightsBetween(body.checkin ?? body.checkIn, body.checkout ?? body.checkOut);
            const tgxHotels: any[]   = (Array.isArray(tgxResult.data) ? tgxResult.data : [])
                .map((h: any) => ({ ...h, price: (h.price ?? 0) / stayNights }));
```
```ts
// after
            /**
             * Already per night — the provider's contract is that a listing carries the Nightly
             * Rate (ADR-0020). Dividing here as well advertised `total / nights²` on every stay
             * of more than one night, once `buildCityResults` began dividing at the source.
             */
            const tgxHotels: any[]   = Array.isArray(tgxResult.data) ? tgxResult.data : [];
```

Phase A and B pictures — gate on `useCatalog`:

```ts
// before
            const missingNow  = [...catalogHotels, ...tgxHotels]
                .filter(needsImages)
```
```ts
// after
            const missingNow  = (useCatalog ? [...catalogHotels, ...tgxHotels] : [])
                .filter(needsImages)
```
```ts
// before
                    const missingLate = extraHotels
                        .filter((h: any) => !(h.images?.length) && !h.image)
```
```ts
// after
                    const missingLate = (useCatalog ? extraHotels : [])
                        .filter((h: any) => !(h.images?.length) && !h.image)
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm --prefix $api run test -- src/__tests__/hotels.searchStream.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the whole suite and type-check**

Run: `npm --prefix $api run test`
Expected: every file passes.

Run: `& "$api\node_modules\.bin\tsc.cmd" -p "$api\tsconfig.json" --noEmit --declaration false`
Expected: exit 0.

- [ ] **Step 6: Commit**

```powershell
git -C $api add src/controllers/hotels.controller.ts src/__tests__/hotels.searchStream.test.ts
git -C $api commit -m @'
fix(hotels): the search stream divides listing prices once

buildCityResults began dividing by nights on 2026-10-05, and searchStream
already divided on 2026-09-25, so TravelgateX cards advertised total/nights^2
on any stay of more than one night. The provider contract is now "a listing
carries the Nightly Rate"; ETG listings are divided at the provider and the
controller no longer divides. The stream also asks the provider rather than a
supplier function, and skips the catalog and ETG pictures for a provider that
owns its content.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 10: Mock mode logs email instead of sending it

**Files:**
- Modify: `src/lib/email/send.ts`
- Test: `src/__tests__/email.transport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/email.transport.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const cfg = vi.hoisted(() => ({
    RESEND_API_KEY: 're_test' as string | undefined,
    EMAIL_TRANSPORT: undefined as string | undefined,
    HOTEL_PROVIDER: undefined as string | undefined,
}));
vi.mock('@/config', () => ({ config: cfg }));
vi.mock('@/lib/brand', () => ({ fromNoReply: () => 'CheapestGo <no-reply@cheapestgo.com>' }));
vi.mock('@/lib/prisma', () => ({
    prisma: { email_logs: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) } },
}));

import { sendTransactionalEmail } from '@/lib/email/send';

const MAIL = { bookingId: 'CG-1', to: 'juan@example.com', subject: 'Booking Confirmed', html: '<p>hi</p>', emailType: 'confirmation' as const };

beforeEach(() => {
    cfg.RESEND_API_KEY = 're_test';
    cfg.EMAIL_TRANSPORT = undefined;
    cfg.HOTEL_PROVIDER = undefined;
    vi.restoreAllMocks();
});

describe('sendTransactionalEmail — transport', () => {
    it('sends through Resend by default', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
        expect(await sendTransactionalEmail(MAIL)).toEqual({ success: true });
        expect(fetchSpy).toHaveBeenCalledWith('https://api.resend.com/emails', expect.anything());
    });

    it('logs instead of sending when the hotel provider is the mock', async () => {
        cfg.HOTEL_PROVIDER = 'mock';
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);

        expect(await sendTransactionalEmail(MAIL)).toEqual({ success: true });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(info).toHaveBeenCalledWith(expect.stringContaining('juan@example.com'));
    });

    it('honours an explicit transport over the provider default', async () => {
        cfg.HOTEL_PROVIDER = 'mock';
        cfg.EMAIL_TRANSPORT = 'resend';
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
        await sendTransactionalEmail(MAIL);
        expect(fetchSpy).toHaveBeenCalled();

        cfg.HOTEL_PROVIDER = undefined;
        cfg.EMAIL_TRANSPORT = 'log';
        fetchSpy.mockClear();
        vi.spyOn(console, 'info').mockImplementation(() => undefined);
        await sendTransactionalEmail(MAIL);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm --prefix $api run test -- src/__tests__/email.transport.test.ts`
Expected: FAIL — the mock-provider case calls `fetch`.

- [ ] **Step 3: Write the implementation**

In `src/lib/email/send.ts`, after the duplicate check and before the `RESEND_API_KEY` check:

```ts
// before
    // Queued rather than dropped: an unconfigured key is a deployment problem, and the mail is
    // still owed to the customer once it is fixed.
    if (!config.RESEND_API_KEY) {
```
```ts
// after
    // A mock supplier makes reservations that do not exist, so the mail about them must not
    // reach a real inbox. Logged, not queued: nothing is owed to anyone.
    const transport = config.EMAIL_TRANSPORT ?? (config.HOTEL_PROVIDER === 'mock' ? 'log' : 'resend');
    if (transport === 'log') {
        console.info(`[email] transport=log — not sending ${p.emailType} to ${p.to}: ${p.subject}`);
        return { success: true };
    }

    // Queued rather than dropped: an unconfigured key is a deployment problem, and the mail is
    // still owed to the customer once it is fixed.
    if (!config.RESEND_API_KEY) {
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm --prefix $api run test -- src/__tests__/email.transport.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```powershell
git -C $api add src/lib/email/send.ts src/__tests__/email.transport.test.ts
git -C $api commit -m @'
feat(email): log instead of send when the hotel provider is the mock

A mock reservation must never mail a real address. EMAIL_TRANSPORT overrides
the default either way.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 11: Verify the phase

- [ ] **Step 1: Full suite**

Run: `npm --prefix $api run test`
Expected: every file passes; file count is 66 + 10 new = 76; no previously passing test is skipped
or edited.

- [ ] **Step 2: Type-check**

Run: `& "$api\node_modules\.bin\tsc.cmd" -p "$api\tsconfig.json" --noEmit --declaration false`
Expected: exit 0.

- [ ] **Step 3: Lint — no new problems**

Run: `npm --prefix $api run lint`
Expected: the same 3 errors as the baseline (`cityAliases.ts` ×2, `destinations.service.ts` ×1) and
no new error. Warnings may change only by files this phase touched; remove any unused import it
introduced.

- [ ] **Step 4: Prove no supplier module is imported above the provider layer**

Run:

```powershell
rg -n "quoteTgx|bookTgx|cancelTgx|runTgxSearch" "$api\src\services" "$api\src\controllers"
```
Expected: no matches in `src/services/hotels.service.ts`. (`flights` files and the destination
service are unrelated.)

- [ ] **Step 5: Commit nothing; write the phase summary**

Summarise: what changed, the six deliberate behaviour changes, the test counts, and the open
questions (below).

---

## Open questions to carry out of this phase

1. `_tgx` / `_tgxToken` are still on the wire for the mobile app's offer-id fallback. Remove them
   when the mobile app stops reading `rate._tgx`?
2. Search listings expose only the Nightly Rate. ADR-0020 says api-v2 should emit both the stay
   total and the nightly rate; add `stayTotal` to listings in Phase 3?
3. Move `searchStream` into a service (it is ~400 lines of branching in a controller)? It now has
   characterization tests, so it is safe to do as its own change.
4. `getHotelProviderById` instantiates the mock for a `provider = 'mock'` booking row only outside
   production; confirm that is the behaviour you want for bookings made in a test environment.

## Self-review

- **Spec coverage:** §3.1 (interface, opaque refs, typed errors, selection, adding a provider) →
  Tasks 1, 5, 6; §3.2 (catalog, pricing, scenarios, state, side effects off) → Tasks 3, 4, 9, 10;
  §3.3 (money) → no change by design, noted in `types.ts`; §5 contract suite → Task 7.
  Phases 2–6 are out of scope for this plan.
- **Placeholders:** none. Every step carries its code or exact edit.
- **Type consistency:** `HotelProvider`, `PrebookInput/Result`, `BookInput`, `ProviderBooking`,
  `CancelInput`, `ProviderCancellation`, `CancellationTerms`, `toPrebookPolicyWire`,
  `toStoredPolicyWire`, `getHotelProvider`, `getHotelProviderById`, `setHotelProviderForTests`,
  `classifyTgxFailure`, `MockHotelProvider.{setScenario,reset,reservations,calls}` are defined once
  and used under those names throughout.
