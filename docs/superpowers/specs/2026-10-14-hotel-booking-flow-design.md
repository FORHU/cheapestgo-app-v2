# Hotel booking flow — provider seam, lifecycle, and hardening

**Date:** 2026-10-14
**Repos:** `cheapestgo-api-v2` (domain, ADR-0017) and `cheapestgo-app-v2` (UI)
**Branch:** `feat/hotel-booking-flow` in both, cut from the current `feat/nearby-*` tips (see *Decisions*)
**Status:** approved to proceed ("continue", 2026-10-14); phase plans follow this document

## 1. Goal

A traveller can search, pick a hotel and room, pay, and receive a confirmed booking, with every
failure path handled. The whole flow must run against a `MockHotelProvider` today, and adding a
real provider later must need only an environment value and one new provider class.

This is not a rebuild. The flow already exists on TravelgateX (TGX) and ETG content; this work puts a
provider seam under it, adds the mock, replaces free-form statuses with a state machine, makes payment
completion server-driven, and closes the failure-path and UX gaps found in the audit.

## 2. Constraints

From the repo's own ADRs (they live in `cheapest-go-app/docs/adr`) and from the brief:

| Constraint | Source | Consequence here |
|---|---|---|
| api-v2 owns domain logic; app-v2 is a frontend | ADR-0017 | State machine, provider layer, pricing: API only. App gets hooks and UI. |
| Layering Route → Controller → Service → Repository; provider clients in `src/lib/` | API `CONTEXT.md` | `HotelProvider` lives in `src/lib/hotels/providers/`, called only from services. |
| Schema is authored as dbmate SQL; Prisma is `db pull` only | ADR-0001/0014/0018 | One SQL migration in `db/migrations/`, shown before it is applied. |
| Stripe base comes from the recorded prebook quote | ADR-0021 | Unchanged. Client amounts are claims, never prices. |
| Refund is what the recorded terms allow; refusing is the safe direction | ADR-0023 | Cancellation keeps `calculateCancellation`; adds a preview, not new rules. |
| Supplier owns reservation state; divergence is detected, not auto-corrected | ADR-0026 | A timed-out `book` is never auto-voided. The sweeper voids un-booked holds and alerts; it does not book. |
| Authentication is required at payment; an unverified email is not a credential | ADR-0027/0029 | Guest checkout and lookup by reference + email are out of scope. |
| A port carries rules, not a dead supplier's shapes | ADR-0025 | No LiteAPI/Rakuten adapters. Extension points are documented, not stubbed. |
| TGX forbids scheduled or background searches | `CONTEXT.md` (TGX Scheduling Constraint) | No cron job calls `search`. |
| Ask before: destructive DB operations, changing public API contracts, live provider credentials | brief | Wire shapes preserved; mock mode touches no supplier; migration shown first. |

## 3. Architecture

### 3.1 Provider seam

```ts
// src/lib/hotels/providers/types.ts
export type ProviderId = 'travelgatex' | 'mock';

export interface ProviderCapabilities {
  /** Can read a reservation back from the supplier. TravelgateX cannot (ADR-0026). */
  bookingRead: boolean;
  /** Is the authority on hotel content and the searchable catalog (skip DB catalog + ETG). */
  providesContent: boolean;
}

export interface HotelProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;
  /** Is this offer / prebook reference one of ours? */
  ownsRef(ref: string): boolean;

  searchHotels(q: HotelSearchParams): Promise<HotelSearchResult>;
  getHotelDetails(hotelId: string): Promise<HotelContent | null>;
  getRates(hotelId: string, stay: StayQuery): Promise<RoomType[]>;
  prebook(input: PrebookInput): Promise<PrebookResult>;   // typed SOLD_OUT / PRICE_CHANGED / ...
  book(input: BookInput): Promise<ProviderBooking>;        // typed REJECTED / UNKNOWN_OUTCOME / ...
  getBooking?(ref: ProviderBookingRef): Promise<ProviderBooking | null>; // iff bookingRead
  cancelBooking(input: CancelInput): Promise<ProviderCancellation>;
}
```

- **Opaque references.** `offerId` / `prebookRef` are `<PROVIDER>:<payload>`. Nothing above the provider
  parses the payload. `ownsRef` replaces the service's `startsWith('TGX:')`.
- **Typed failure.** `HotelProviderError.code` is one of `INVALID_RATE`, `SOLD_OUT`, `PRICE_CHANGED`,
  `NOT_PAYABLE_ONLINE`, `REJECTED`, `TIMEOUT` (nothing was sent or no answer for a read),
  `UNKNOWN_OUTCOME` (a mutation may have reached the supplier), `UNAVAILABLE`. The orchestrator branches
  on the code, never on message text.
- **Search/rates keep the existing neutral listing types** (`HotelListing`, `RoomType`). They already
  carry no supplier vocabulary except the underscore-private `_tgx` / `_tgxToken` passthrough, which the
  mobile app reads as a fallback. Those fields stay on the wire; no service reads them. Removing them is a
  contract decision, deferred.
- **Selection.** `HOTEL_PROVIDER=travelgatex|mock` (default `travelgatex`) through `getHotelProvider()`.
  `mock` is refused when `NODE_ENV=production` unless `ALLOW_MOCK_HOTEL_PROVIDER=true`, in both
  `config.ts` and the factory.
- **Adding a provider** = one class implementing `HotelProvider`, one `case` in the factory, one entry in
  the config enum, and the shared contract suite passing against it.

### 3.2 MockHotelProvider

Deterministic, in-process, no network, no database.

- **Catalog:** ~16 Philippine properties (Manila/Makati/BGC, Cebu, Boracay, El Nido, Coron, Siargao,
  Davao, Baguio, Tagaytay, Panglao) with real-area coordinates, 3 room types and 3 rate plans each
  (room-only non-refundable; breakfast refundable until check-in − 3 days; half-board tiered).
- **Pricing:** a pure function of (hotel, room, plan, dates, party). Weekend uplift. Whole-stay totals,
  `net = 0.9 × gross`, supplier currency `USD` (override `MOCK_HOTEL_CURRENCY`) so the FX path is exercised.
- **Scenarios** (precedence: `setScenario()` in tests → `MOCK_HOTEL_SCENARIO` → the hotel's own scenario
  → `ok`): `ok`, `price_up` (+8% at prebook), `price_down` (−5%), `sold_out` (listed, gone at prebook),
  `prebook_timeout`, `book_rejected`, `book_timeout` (reservation **exists**, caller sees
  `UNKNOWN_OUTCOME`), `cancel_rejected`, `cancel_timeout`. Six "QA …" hotels in Manila carry one each, so
  every scenario is reachable from the normal UI without touching the environment.
- **State:** in-memory bookings keyed by client reference, a call log (`calls`), an injectable clock.
  `book` with a repeated client reference creates a second reservation unless `dedupeByClientRef` is set —
  a naive supplier on purpose, so a double-submit bug shows up as `bookings.length === 2`.
- **Side effects off:** with `HOTEL_PROVIDER=mock`, the DB catalog and ETG content are skipped (the provider
  is the authority) and email is logged, not sent, unless `EMAIL_TRANSPORT=resend` is set explicitly.

### 3.3 Money

- Supplier quotes are decimals in the supplier currency, whole-stay (the existing **Stay Total**); the
  service keeps its current arithmetic so charges stay byte-identical to today.
- Everything we **store or charge** from the new lifecycle onward is `amount_minor BIGINT` + `currency`,
  produced by the existing `toStripeAmount` (zero-decimal aware). Legacy decimal columns keep being written.
- Conversion stays server-side and strict (`makeStrictConverter`); Display Currency = Charge Currency ∈ the
  chargeable set. No new conversion code.

### 3.4 Lifecycle state machine

New aggregate `hotel_bookings` (workflow state) beside the legacy `bookings` row (the sale, written at
`CONFIRMED`, read by trips/invoices/admin/mobile). Same reference string links them.

```
DRAFT ─► PREBOOKED ─► PAYMENT_PENDING ─► PAYMENT_AUTHORIZED ─► SUPPLIER_BOOKING ─► CONFIRMED
              │               │                    │                    │              │
              ▼               ▼                    ▼                    ├─► FAILED     ├─► CANCEL_REQUESTED
           FAILED          EXPIRED              FAILED (voided)         └─► NEEDS_REVIEW   ├─► CANCELLED
                                                                                           └─► REFUND_PENDING ─► REFUNDED | REFUND_FAILED
```

- Transitions are a pure table with `assertTransition(from, to)`; every move appends a
  `hotel_booking_events` row (actor: `browser | webhook | sweeper | admin`, reason, payload).
- A mapping function projects lifecycle → legacy `bookings.status`
  (`CONFIRMED→confirmed`, `CANCELLED→cancelled`, `REFUNDED→cancelled_refunded`, …) so v1/admin/mobile keep working.
- In-flight and abandoned attempts never appear in `bookings`, so they never show up as trips and never
  trip the existing duplicate-booking guard.

### 3.5 Payment completion

Sequence stays **authorize (manual capture) → supplier book → capture** — a void is free and instant, a
refund is not.

`complete(booking)` is the single idempotent routine, reachable from the browser's confirm call **and** the
Stripe webhook (`payment_intent.amount_capturable_updated`):

1. Re-read the PaymentIntent; require `requires_capture`, amount, currency, and our reference in metadata.
2. **Claim:** `UPDATE … SET status='SUPPLIER_BOOKING' WHERE id=$1 AND status='PAYMENT_AUTHORIZED'`. One
   caller wins; the rest return the current state. A unique index on `payment_intent_id` is the backstop.
3. `provider.book(...)`, then:

| Outcome | Money | State |
|---|---|---|
| success | capture (idempotency key per booking); on capture failure retry, then flag | `CONFIRMED` / `NEEDS_REVIEW` |
| `SOLD_OUT`, `PRICE_CHANGED`, `REJECTED`, `NOT_PAYABLE_ONLINE` | **void** the authorization | `FAILED` |
| `TIMEOUT`, `UNKNOWN_OUTCOME` | **keep the hold** | `getBooking` if the provider can; else `NEEDS_REVIEW` + notification |

4. Only after capture: write the legacy `bookings` row, policy snapshot, FX lock, send the confirmation.

The sweeper (`cron`) voids `PAYMENT_PENDING`/`PAYMENT_AUTHORIZED` attempts older than the TTL that have **no
supplier attempt**, and alerts on the rest. It never calls the supplier.

### 3.6 API surface (additive)

Existing endpoints keep their request and response shapes and are re-implemented on the orchestrator, so
the current checkout and the mobile app gain the hardening without a contract change. New, additive:

| Endpoint | Purpose |
|---|---|
| `POST /hotels/prebook` (extended) | optional `expectedTotal`; response gains `priceChange {previous, current, direction}` |
| `GET /hotels/bookings/:reference` | lifecycle status for polling and the persistent confirmation page |
| `GET /hotels/bookings/:reference/cancel-preview` | refund amount, penalty, deadline — from the recorded snapshot |

Errors keep the existing `{ error: CODE, message, ...details }` envelope; the codes the UI maps are
documented and exported as a union in both repos.

### 3.7 Frontend (app-v2)

- Split the 1,477-line checkout page into `useHotelCheckout` (state machine mirror), `usePrebook`,
  `useCheckoutPayment`, and small presentational components; no domain rules move to the browser.
- Persistent confirmation at `/booking/[reference]` (reads the status endpoint; survives refresh; no
  random reference fallback).
- Price-changed and unavailable become panels with explicit **Accept new price** / **Choose another room**.
- Guest form: holder, co-guests, phone (actually sent and stored), special requests, child ages; one
  mirrored zod schema, i18n'd messages; validation errors map field-by-field.
- Hotel cancel uses a modal with the refund preview; trips list/detail adapt to the existing API contracts.

## 4. Data model (one dbmate migration, shown before applying)

`hotel_bookings`, `hotel_booking_guests`, `hotel_booking_payments`, `hotel_booking_events`; indexes: unique
`booking_reference`, unique `payment_intent_id`, partial unique `(user_id, prebook_ref)` for live attempts,
`(status, created_at)` for the sweeper. No change to `bookings` columns beyond what the projection needs.

## 5. Testing

- **Contract suite** run against every provider (TGX adapter over mocked supplier functions; mock real):
  the guarantee behind "a new provider needs only a class".
- **Unit:** state machine, money helpers, TGX error classification, mock determinism/scenarios, schemas.
- **Integration:** `HotelsService` and the orchestrator against `MockHotelProvider` with Stripe/DB doubles:
  price change, sold out, payment failure, supplier failure after payment, timeout (unknown outcome), double
  submit, cancellation, webhook-before-browser and browser-before-webhook.
- Existing suites (834 API, 964 app) stay green throughout; they are the characterization net for the seam.

## 6. Phases

| # | Phase | Ships on its own? |
|---|---|---|
| 1 | Provider layer: interface, factory, TGX adapter, mock, contract suite, service rewired (no wire change) | yes |
| 2 | Lifecycle: state machine, migration, orchestrator, webhook completion, void-on-failure, sweeper | yes |
| 3 | Search/results/details deltas: fuzzy tier, numbered pins, details breakdown, prebook price-change data | yes |
| 4 | Checkout + Stripe UI: hooks, schema, price-change panels, 3DS and failure states, confirmation route | needs 2 |
| 5 | Trips, cancel preview/modal, contract fixes | needs 2 |
| 6 | Integration scenarios and `docs/booking-flow.md` | closes |

## 7. Decisions taken on the user's behalf

Answered by "continue" with the stated defaults:

1. Approach A (strangler seam), manual-capture sequence kept.
2. Migrations as dbmate SQL in api-v2 `db/migrations/` (as the last two were).
3. Guest checkout and lookup by reference + email: out of scope.
4. Shared zod schema: API-owned; app mirror guarded by contract fixtures.
5. fuse.js: added to the API, inside the alias matcher only (Phase 3), since the brief names it.
6. **Branch base — deviates from the stated default.** `main` is 76 (API) / 120 (app) commits behind and
   lacks the entire hotel port, so it cannot be the base. Both branches are cut from the current
   `feat/nearby-*` tips: identical working tree (a dev server may be running), and every audited file is
   present. Re-basing onto the integration branches is one command per repo:
   `git rebase --onto origin/updates-api origin/feat/nearby-poi-details feat/hotel-booking-flow` and
   `git rebase --onto origin/updates origin/feat/nearby-places feat/hotel-booking-flow`.
7. Trips contract mismatch is fixed app-side (the mobile app may consume the API).

## 8. Out of scope / deferred

- Guest checkout and lookup by reference + email.
- Removing `_tgx` / `_tgxToken` from the wire (the mobile app reads `_tgx` as a fallback).
- Extracting `searchStream` into a service (needs controller-level characterization tests first); Phase 1
  only swaps its supplier call for `provider.searchHotels`.
- Multi-room bookings: search builds one occupancy for the whole party and `book` sends
  `occupancyRefId: 1`, so N rooms needs per-room occupancies end to end. Until then the UI says so rather
  than silently booking one room for a multi-room search (Phase 4).
- Replacing or splitting `lib/hotels/search.ts` (1,762 lines of QA-hardened supplier logic).
