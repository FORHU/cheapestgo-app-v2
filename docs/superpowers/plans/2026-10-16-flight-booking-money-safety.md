# Flight booking — Slice 1: money safety — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop charging a traveller before the airline has answered. Flights move from *order → charge* to the hotel order of operations: **authorise → Duffel order → capture**, with an attempt lifecycle, an atomic claim, webhook completion and a sweeper. No request or response shape changes, so mobile keeps working.

**Architecture:** `booking_sessions` is the attempt record (it already holds passengers, contact, fare policy, charged price, PaymentIntent id, idempotency key). A new `lifecycle_status` column carries a state machine; `flight_booking_events` appends one row per move. `FlightBookingLifecycleService` owns claim → place order → capture/void. `confirm` and the `payment_intent.amount_capturable_updated` webhook both call the same completion routine; a cron sweeper voids abandoned holds.

**Tech Stack:** TypeScript (strict), Express, Prisma + raw SQL, Stripe, Vitest. No new dependency.

**Repo:** API work is in `cheapestgo-api-v2` (the `-nearby` worktree). App work is in `cheapestgo-app-v2-nearby`. This plan lives beside the hotel specs and plans.

**Reference implementation to mirror:** `src/lib/hotels/lifecycle/stateMachine.ts`, `src/services/hotelBookingLifecycle.service.ts`, `src/repositories/hotelBookingLifecycle.repository.ts`, `db/migrations/20261015000001_hotel_booking_lifecycle.sql`, `docs/booking-flow.md`.

**Status of the design:** sections 1 and 2 below were drafted with the user on 2026-10-16 and the direction ("money safety first", "reorder like hotels") was chosen by them. The detail in §1–§2 was **not** explicitly signed off before this plan was written; review it before Task 3 onwards.

---

## 0. Scope

**In this slice:** `book` → `confirm` → Stripe webhook → sweeper, plus the minimum app and mobile adaptation.

**Not in this slice:** a `FlightProvider` seam and mock (slice 2), a flight cancel preview (slice 3), Mystifly (still refused at `book` with 422), any change to cancel/refund behaviour.

## 1. Flow

| Step | What happens |
|---|---|
| `book` | Re-fetch the offer, run the duplicate-departure guard, compute markup + FX, validate seats/bags against the offer. Open a **manual-capture** PaymentIntent. Write the attempt as `PAYMENT_PENDING`. **Place no Duffel order.** Response shape unchanged. |
| card authorised | Stripe reaches `requires_capture`. `POST /flights/confirm` and the `payment_intent.amount_capturable_updated` webhook both call the same completion routine. |
| completion | Atomic claim (`UPDATE … WHERE lifecycle_status='PAYMENT_AUTHORIZED'`) so exactly one caller reaches Duffel. Record `supplier_booking_attempts` **before** the call. Place the instant order with the idempotency key. Apply the outcome table. |
| sweeper | Never calls Duffel, never books. Voids stale holds; raises attention for stuck attempts. |

**Outcome table**

| Duffel says | Money | State |
|---|---|---|
| Ordered | Capture (idempotency key, one retry) | `CONFIRMED` |
| Definitive refusal (offer expired, price over tolerance, invalid passenger/seat) | Void | `FAILED` |
| Timeout / 5xx | Keep the hold. Run `findOrderFromTimedOutAttempt`. Found → carry on as booked. Not found → leave for a person. | `NEEDS_REVIEW` |

A timed-out order is **never** auto-voided: Duffel may have issued the ticket.

**Price moved after authorisation.** The hold can be captured for less, never for more. Down → capture the recomputed lower amount. Up beyond `getFlightPriceTolerance()` → void, return `PRICE_CHANGED`, traveller restarts.

**Sweeper (new cron, every 10 min).** Voids `PAYMENT_PENDING` older than 2 h and `PAYMENT_AUTHORIZED` older than 30 min with no supplier attempt recorded. Notifies on `SUPPLIER_BOOKING` / `NEEDS_REVIEW` older than 15 min.

## 2. Data and code

**Migration** `db/migrations/20261016000001_flight_booking_lifecycle.sql`, additive, applied by hand, code degrades to today's behaviour while absent:

- `booking_sessions.lifecycle_status text NOT NULL DEFAULT 'PAYMENT_PENDING'` with a CHECK over the six states. Separate from the free-form `status`, which other code still reads.
- Unique index on `booking_sessions(payment_intent_id) WHERE payment_intent_id IS NOT NULL` — backstop for the claim.
- Index on `(lifecycle_status, created_at)` for the sweeper.
- `flight_booking_events(id, session_id, from_status, to_status, actor, reason, payload jsonb, created_at)`.
- `duffel_pre_order_*` columns are left alone and become unused.

> **Backfill caution.** The column default is `PAYMENT_PENDING`, so every existing row would look in-flight and the sweeper would try to void it. The migration must set existing rows explicitly: `completed` → `CONFIRMED`, `failed` → `FAILED`, everything else → `EXPIRED`.

**States:** `PAYMENT_PENDING → PAYMENT_AUTHORIZED → SUPPLIER_BOOKING → CONFIRMED`; exits `FAILED`, `EXPIRED`, `NEEDS_REVIEW` (→ `CONFIRMED | FAILED`). No cancel/refund states (cancel is out of scope).

**Code by layer**

| File | Role |
|---|---|
| `src/lib/flights/lifecycle/stateMachine.ts` | Pure transition table. Reuses `LifecycleActor`. |
| `src/repositories/flightBookingLifecycle.repository.ts` | Atomic `transition`, `note`, `findByPaymentIntent`, `findAbandoned`, `findNeedingAttention`. Returns `'unavailable'` when the migration is absent. |
| `src/services/flightBookingLifecycle.service.ts` | `claim`, `complete`, outcome table, `capture`, `voidAuthorisation`, `sweep`. |
| `src/lib/flights/completeDuffelBooking.ts` | The projection to `flight_bookings` / segments / passengers / email, **extracted** from `handleDuffel` in `internal.route.ts`. |
| `src/lib/flights/orderPassengers.ts` | E.164 phone, titles, identity documents — extracted from `FlightsService.book`. |
| `src/routes/cron.route.ts` | `GET /flight-booking-sweep`, modelled on `/hotel-booking-sweep`. |

**`flight_bundle`: traced, no coupling.** `bundleHotelId` is only PaymentIntent metadata (`type: 'flight_bundle'`). The hotel half completes on its own PaymentIntent as `hotel_bundle`. The webhook branch handles `flight` and `flight_bundle` identically.

**Shared with hotels.** Stripe capture/void with an idempotency key and one retry (`HotelBookingLifecycleService.capture` / `voidAuthorisation`) is identical in both. Task 4 extracts it to `src/lib/payments/` only if it is byte-for-byte the same logic, with the hotel suite as the safety net. Do not refactor the hotel service speculatively.

## 3. Behaviour changes this slice makes on purpose

| # | Change | Why |
|---|---|---|
| 1 | `book` no longer places a Duffel order | The card is never charged for a ticket the airline then refuses |
| 2 | PaymentIntent is `capture_method: 'manual'` | An authorisation can be voided for free |
| 3 | An expired or repriced offer surfaces **after** card entry as `OFFER_EXPIRED` / `PRICE_CHANGED`, with the hold released | The cost of reordering. `book` still catches what it can before the card |
| 4 | Pre-order reuse (`findLivePreOrder`) and superseded-order cleanup are deleted | There is no pre-order to reuse |
| 5 | `confirm` may answer "still processing" instead of a booking | Timeout path; the traveller is pointed at their trips |
| 6 | `confirm` accepts `requires_capture`, not only `succeeded` | Authorised, not yet captured |

Mystifly, cancel, refund and every read endpoint are unchanged.

---

## Conventions for every task

PowerShell, from any directory (no `cd`):

```powershell
$api = 'c:\Users\USER\Documents\GitHub\cheapestgo-api-v2-nearby'
npm --prefix $api run test -- src/__tests__/<file>.test.ts
npm --prefix $api run test
& "$api\node_modules\.bin\tsc.cmd" -p "$api\tsconfig.json" --noEmit --declaration false
npm --prefix $api run lint
```

Commits use the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Test-first for every task that has logic.

## Task 0 — Baseline and branch

- [x] Create `feat/flight-booking-money-safety` from the current branch tip. Do not carry the uncommitted `auth.route.ts` / `auth.logout.test.ts` changes into it. *(Branched from `7a718c1`. The two auth files are still unstaged in the working tree, as before; they are never staged by this work.)*
- [x] Run the suite, `tsc` and lint; record the numbers here. Do not trust the hotel plan's "66 files / 834 tests" — it predates later commits. *(2026-10-16: **89 files / 1195 tests passing**; `tsc` exit 0; lint **0 errors, 25 warnings**. The suite was run with the auth WIP present in the working tree.)*
- [x] Confirm `src/__tests__/flights.service.test.ts` (64 mentions of flight) passes; it pins `book` and `confirm` today and will need deliberate edits in Tasks 5–6. *(30 tests, passing.)*

## Task 1 — Migration (show before applying)

- [x] Write `db/migrations/20261016000001_flight_booking_lifecycle.sql` per §2, including the backfill and a `-- migrate:down` that drops only what it added. *(Written, **uncommitted** pending review. Differences from §2, all deliberate: the column is added nullable, backfilled `WHERE lifecycle_status IS NULL`, then given its default and `NOT NULL` — so re-running the hand-applied file cannot reset live attempts to `EXPIRED`; legacy `booked` maps to `CONFIRMED` beside `completed`; the CHECK lists **seven** states, §2 said "six" but names seven; a duplicate-PaymentIntent check is in the header, to run before the unique index; the up section is one `BEGIN … COMMIT` — no other migration here uses one — so it applies whole or not at all and no row can land between the backfill and `NOT NULL`.)*
- [ ] **Show the SQL to the user and wait.** It is applied by hand to the shared database; nothing in this plan applies it.
- [ ] After it is applied: `prisma db pull`. Until then the code uses raw SQL.

## Task 2 — State machine

- [x] Test: every legal edge is allowed, every other edge rejected, terminal states have no exits, `NEEDS_REVIEW` can reach `CONFIRMED` and `FAILED` only.
- [x] Implement `stateMachine.ts` (pure; `InvalidTransitionError`, `canTransition`, `allowedTransitions`). *(Commit `3eb5a50`; 13 tests. The test also pins the state list to the migration's CHECK constraint.)*

## Task 3 — Repository

- [ ] Tests (mock the DB client as the hotel repository tests do): a transition applies once and a racing second caller gets `'lost'`; a missing column/table returns `'unavailable'` and never throws; every applied move writes an event with actor and reason.
- [ ] Implement `flightBookingLifecycle.repository.ts`.

## Task 4 — Extractions (no behaviour change)

- [ ] Extract `completeDuffelBooking(sessionId, paymentIntentId, order)` from `handleDuffel`. `handleDuffel` calls it. The existing `/internal/create-booking` tests must pass unchanged.
- [ ] Extract `buildOrderPassengers(rawOffer, passengers, contact)` from `FlightsService.book`. Existing `duffelIdentityDocuments` and `flights.service` tests must pass unchanged.
- [ ] Compare the hotel `capture` / `voidAuthorisation` with what flights needs. Identical → move to `src/lib/payments/stripeCapture.ts`, hotel service delegates, hotel suites green. Different → leave both, note why here.

## Task 5 — `FlightBookingLifecycleService`

- [ ] Tests, one per outcome-table row plus: lost claim answers from the winner's record; capture retries once then reports; void is skipped after a timeout; price down → partial capture; price up → void + `PRICE_CHANGED`; timeout with a recovered order → `CONFIRMED`; recovered nothing → `NEEDS_REVIEW` and the hold is kept.
- [ ] Implement `claim`, `complete` (re-fetch the stored `_offerId`, `placeDuffelOrder` with the session's idempotency key, record `supplier_booking_attempts` first), `capture`, `voidAuthorisation`.
- [ ] `complete` re-derives the charge from the new Duffel total with the same `applyMarkup` / FX path as `book`, so the capture amount is computed, never assumed.

## Task 6 — Rewire `FlightsService`

- [ ] `book`: delete the Duffel pre-order block, `findLivePreOrder`, `cancelDuffelOrderQuietly` use and the orphan guard. Keep offer re-fetch, duplicate guard, seat/bag totals, pricing. Compare the re-fetched offer total with `confirmedPrice` using `getFlightPriceTolerance()` and throw `PRICE_CHANGED` before the card is shown.
- [ ] `capture_method: 'manual'`; keep metadata (`type: 'flight' | 'flight_bundle'`, `bookingSessionId`); write `lifecycle_status = PAYMENT_PENDING`. Write `booking_sessions.capture_method = 'manual'` as well as the Stripe parameter — today nothing writes that column (it sits at its `automatic` default; `flights.service.ts:560` is the Stripe parameter), and the sweeper and `auto-recover` guards below key on it.
- [ ] `confirm`: verify session/PI match, accept `requires_capture`, call the lifecycle service, map outcomes to the existing response shape. Drop the internal HTTP fetch to `/api/internal/create-booking`.
- [ ] Update `flights.service.test.ts` deliberately; each changed expectation maps to a row in §3.

## Task 7 — Webhook completion

- [ ] Test (pattern: `webhooks.stripe.hotelAuthorisation.test.ts`): a `flight` and a `flight_bundle` PaymentIntent route to the flight completion; a hotel one does not; a thrown error is logged, not rethrown.
- [ ] Add the metadata branch to `payment_intent.amount_capturable_updated` in `webhooks.route.ts`.

## Task 8 — Sweeper

- [ ] Test `sweep()` with injected `now`: stale pending/authorised-with-no-attempt are voided; fresh ones are untouched; stuck `SUPPLIER_BOOKING` / `NEEDS_REVIEW` are reported, never touched; the sweeper imports nothing from `lib/flights/duffel`.
- [ ] Add `GET /flight-booking-sweep` to `cron.route.ts` and the `docker/cron/crontab` line (10 min), mirroring the hotel sweep.

## Task 9 — Status read

- [ ] `getBookingStatus` also reports the lifecycle (`pending` / `processing` / `needs_review` / `failed`) when no `flight_bookings` row exists yet, so a refresh mid-completion shows progress instead of "not found". Keep the existing fields.

## Task 10 — App (`cheapestgo-app-v2-nearby`)

Already true: the shared Stripe form accepts `requires_capture` (`checkout/page.tsx:453`).

- [ ] `handleFlightPaid`: map `PRICE_CHANGED`, `OFFER_EXPIRED` and "still processing" to distinct messages. Processing links to trips rather than showing an error.
- [ ] Copy on the payment step: the card is authorised now and charged when the airline confirms.
- [ ] Idempotency key is `flight-${offerId}-${email}` per offer, not per attempt. Confirm that a retry after a void is not answered by a stale session; if it is, add an attempt nonce.
- [ ] Component tests for the three error paths.

## Task 11 — Mobile (open item)

- [ ] The mobile app is not in this workspace. Before release, confirm it does not wait for PaymentIntent status `succeeded` after `confirmPayment` — with manual capture it will see `requires_capture`. Record the answer here.

## Task 12 — Docs and verification

- [ ] `docs/flight-booking-flow.md` in the API repo, in the style of `docs/booking-flow.md`: the flow, the outcome table, every failure path, how to read `flight_booking_events`.
- [ ] Suite, `tsc`, lint at or better than the Task 0 baseline.
- [ ] Sandbox end-to-end with the Duffel test token and Stripe test cards: happy path; offer expired between `book` and `confirm`; browser closed after authorisation (webhook completes); abandoned checkout (sweeper voids); confirm and webhook racing (one order only).
- [ ] Verify via `flight_booking_events` that no path leaves money captured without an order, or an order without a booking row.

## Found while executing Task 1 — two existing crons the plan did not cover

Both run every 10 minutes (`docker/cron/crontab`) and both act on flight sessions or orders. Neither is mentioned above. **Settle these before Task 6 changes what `book` writes.**

1. **`POST /internal/auto-recover`** (`internal.route.ts:639`). Takes any `booking_sessions` row with a `payment_intent_id`, legacy `status` not in `booked/expired/completed/failed`, older than 5 min and younger than 24 h, with no `flight_bookings` row. For Duffel it recovers only if the PaymentIntent is `succeeded`; otherwise it sets `status = 'expired'`. Under manual capture an authorised card is `requires_capture`, so a legitimately authorised, not-yet-completed attempt — or one held in `SUPPLIER_BOOKING` / `NEEDS_REVIEW` — is stamped `expired`, contradicting `lifecycle_status`. **Fix (Task 8):** exclude the new flow's sessions (`provider = 'duffel' AND capture_method = 'manual'`) from this query; the new sweeper owns them.
2. **`GET /cron/cleanup-orphaned-duffel-orders`** (`cron.route.ts:406`). Cancels the Duffel order of any `flight_bookings` row whose `status` is `payment_initiated/initiated/pending`, older than 35 min, whose PaymentIntent is not `succeeded`. If `completeDuffelBooking` writes the `flight_bookings` row **before capture**, a kept hold (`NEEDS_REVIEW`, capture failed) would have its order cancelled. **Fix (Task 4/5):** `completeDuffelBooking` runs **after** a successful capture and writes a non-pending status, as the hotel flow writes its sale only once money is captured; the Duffel order id for a capture-failed attempt is kept in `flight_booking_events.payload`. Add a test that pins this. Then exclude lifecycle-governed rows from the cron as a second guard.

**Sweeper guard (Task 8).** The column default is `PAYMENT_PENDING`, so a session written by *old* code between the migration being applied and the new code deploying reads in-flight. The sweeper must only void sessions with `provider = 'duffel' AND capture_method = 'manual'` — which old code never writes (see Task 6) — so an automatic-capture PaymentIntent is never treated as a hold to release.

## Risks

- **Reordering exposes expiry after the card.** Mitigated by the pre-card price/offer check in Task 6 and the free void; not eliminated.
- **A Duffel order succeeds and capture then fails.** Handled as `NEEDS_REVIEW` with the order recorded, never a void. The hotel service already follows this rule.
- **Migration not yet applied in an environment.** Code must run on the old behaviour there; the repository's `'unavailable'` result is what makes deploy-before-apply safe. Test this explicitly in Task 3.
- **`status` vs `lifecycle_status`.** Two columns for a while. Nothing new may read `status` for decisions.
