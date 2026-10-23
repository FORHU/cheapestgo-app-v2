# Hotel Booking Flow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three Critical money-path bugs found in the hotel booking flow review (2026-10-21), land the uncommitted layer that sits on top of them cleanly, then work through the Minor findings from the same review.

**Architecture:** No architectural change. Each task is a targeted fix inside the existing state machine (`hotel-checkout-machine.ts`), hook (`use-hotel-checkout.ts`), page (`checkout/page.tsx`), and — for Task 3 only — the API repo's `hotels.service.ts` price-change guard. Every behavior-changing task is test-first: a failing regression test, then the minimal fix.

**Tech Stack:** Next.js 15 / React 18 / TypeScript (app repo `cheapestgo-app-v2-nearby`), Express/Prisma (API repo `cheapestgo-api-v2-nearby`), Vitest + Testing Library.

**Repos involved:** Tasks 0, 1, 2, 4–12 touch only the app repo (`cheapestgo-app-v2-nearby`, this repo). Task 3 touches both the app repo and the API repo (`cheapestgo-api-v2-nearby`, a sibling checkout at `C:\Users\USER\Documents\GitHub\cheapestgo-api-v2-nearby`).

**Scope note:** This plan covers the review's **Critical** issues and **Minor** issues, per what was asked. It deliberately does **not** cover the 9 **Important** issues from the same review (e.g. the `/booking/[reference]` page showing a cancelled booking as "Booked", confirm-errors treated as definite when a webhook could still complete the booking, dead components). Those are real and were independently re-verified while writing this plan — see the hand-off note at the end for specifics — but are out of scope here; ask for a follow-up plan if you want them addressed too.

**A second scope note, found while writing this plan:** the review's Minor #3 ("hardcoded English in hotel trips screens") turned out to be two different-sized problems. The hardcoded *strings* (`"Check-in"`, `"Free cancellation available"`, etc. in `booking-detail.tsx`) are a contained, if sizeable, i18n task — 15+ new keys across 4 locale files, requiring real Japanese/Korean/Chinese translations, not duplicated English. That's bigger than "minor" and risks shipping wrong translations if rushed, so it is **not** included below. The hardcoded *dates* (`'en-US'` in `toLocaleDateString`) turned out to be systemic: the shared utility these files should be using, `src/shared/lib/format.ts`, **also** hardcodes `'en-US'` — it is not locale-aware at all. Fixing dates properly means threading `useLocale()` through a shared utility used across the whole app, which is well beyond one feature's "minor" cleanup. Neither is in this plan; flag them for a dedicated i18n pass.

---

### Task 0: Land the existing uncommitted layer cleanly

Before any new fix, the working tree already has uncommitted changes (made earlier this session, unrelated to this plan): `checkout/page.tsx` was split so flights and hotels no longer share one confirmation screen, and every name field's example placeholder was unified to "John"/"Doe". `src/features/checkout/components/flight-confirmed-screen.tsx` is new and `page.tsx` already imports it — but it is untracked. Committing `page.tsx` without it breaks the build for anyone else who pulls. There's also a leftover: `src/__tests__/checkout-helpers.test.ts` still fixtures the old 'Mike'/'Hunt' co-guest names against dead code (`buildConfirmGuests`, which nothing imports anymore).

**Files:**
- Add: `src/features/checkout/components/flight-confirmed-screen.tsx` (already written, untracked)
- Add: `src/features/checkout/hooks/use-flight-offer.ts` (already written, untracked)
- Modify: `src/__tests__/checkout-helpers.test.ts` — remove the dead `buildConfirmGuests` test and its 'Mike'/'Hunt' fixtures
- Modify: `src/features/checkout/lib/checkout.helpers.ts` — remove the now-unused `buildConfirmGuests`

- [ ] **Step 1: Confirm nothing else references `buildConfirmGuests`**

Run: `grep -rn "buildConfirmGuests" src/ --include="*.ts" --include="*.tsx"`
Expected: only `checkout.helpers.ts` (the definition) and `checkout-helpers.test.ts` (the test). If anything else comes up, stop and re-scope this step — don't delete a function something else still calls.

- [ ] **Step 2: Remove the dead function and its test**

In `src/features/checkout/lib/checkout.helpers.ts`, delete the `buildConfirmGuests` function.

In `src/__tests__/checkout-helpers.test.ts`, delete the `describe`/`it` block(s) that exercise `buildConfirmGuests` and its import.

- [ ] **Step 3: Run the full existing test suite to confirm nothing else broke**

Run: `npx vitest run`
Expected: same pass count as before, minus the deleted tests; no new failures. (Two suites — `flight-summary-card.test.tsx` and `flight-itinerary.test.tsx` — will still fail because they import files that were never committed; that's pre-existing and unrelated to this plan. Confirm it's only those two.)

- [ ] **Step 4: Commit the uncommitted layer as its own commit, before any new fix**

```bash
git add src/features/checkout/components/flight-confirmed-screen.tsx \
        src/features/checkout/hooks/use-flight-offer.ts \
        "src/app/[locale]/checkout/page.tsx" \
        src/__tests__/checkout-flight-page.test.tsx \
        src/__tests__/checkout-hotel-page.test.tsx \
        src/features/checkout/lib/checkout.helpers.ts \
        src/__tests__/checkout-helpers.test.ts
git commit -m "refactor(checkout): split the flight confirmation screen out of the hotel one"
```

(This commit intentionally does not include the header/footer/help/locale edits from the logo and footer-page work — those are an unrelated, separate change already in the working tree. Leave them for their own commit.)

---

### Task 1: Fix the stuck "Try again" spinner (Critical #1)

**The bug:** `StripePaymentForm` (shared by both checkout flows) sets the *page-level* `submitting` flag true on every click, but only ever clears it in its own `error` and `else` branches — never after a successful `onSuccess(...)`. Flight survives this because `handleFlightPaid` (the `onSuccess` callback for flights) has its own `finally { setSubmitting(false) }` that runs regardless of outcome. Hotel's `onSuccess` is `hotel.onCardAuthorised`, a hook function that manages its own `busy` state and has no way to reach the page's `submitting` setter — so once a hotel card is successfully authorised, `submitting` is permanently stuck `true`. It only goes unnoticed because the page then shows a different screen. The moment a *subsequent* confirm fails and `restart()` brings the form back, the "Continue to payment" button is a permanently disabled spinner.

**Files:**
- Modify: `src/app/[locale]/checkout/page.tsx:449-502` (`StripePaymentForm`), `:939` (`hotelSubmitting`), `:1377-1378` and `:1588, :1603-1604` (call sites)
- Test: `src/__tests__/checkout-hotel-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to the `describe('paying and confirming', ...)` block in `src/__tests__/checkout-hotel-page.test.tsx`, right after the existing `'does not show a confirmed booking when the supplier refused it'` test:

```tsx
    it('lets the traveller pay again after a failed booking, instead of a permanent spinner', async () => {
        api({ confirm: () => ({ success: false, providerConfirmed: false, error: 'Room is gone' }) });
        await toPayment();
        proceed();
        fireEvent.click(await screen.findByRole('button', { name: /pay usd/i }));

        fireEvent.click(await screen.findByRole('button', { name: /try again/i }));

        await waitFor(() => expect(screen.getByRole('button', { name: /continue to payment/i })).toBeEnabled());
    });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/checkout-hotel-page.test.tsx -t "permanent spinner"`
Expected: FAIL — the "Continue to payment" button stays disabled (it's reading `hotelSubmitting`, which is stuck `true`).

- [ ] **Step 3: Give `StripePaymentForm` its own local "click" state, instead of sharing the page's `submitting`**

In `src/app/[locale]/checkout/page.tsx`, replace the `StripePaymentForm` function (currently lines 449–502):

```tsx
function StripePaymentForm({
    onSuccess, onError, total, currency, country, submitting, palette,
}: {
    onSuccess: (paymentIntentId: string) => void;
    onError:   (msg: string) => void;
    total:     number;
    currency:  string;
    country?:  string;
    submitting: boolean;
    palette:   Palette;
}) {
    const t = useTranslations('checkout');
    const stripe = useStripe();
    const elements = useElements();
    // Local to this click, not the page's `submitting`: that flag is only ever reset by the
    // flight path's own confirm handler (`handleFlightPaid`'s `finally`). Sharing it left the
    // hotel path's Pay button permanently disabled after any booking failure that brought the
    // traveller back to the form, because nothing in the hotel path ever flipped it back off.
    const [clicking, setClicking] = useState(false);

    const handlePay = useCallback(async () => {
        if (!stripe || !elements) return;
        setClicking(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: `${window.location.origin}/trips?payment=success` },
            redirect: 'if_required',
        });

        if (error) {
            onError(error.message || 'Payment failed. Please try again.');
            setClicking(false);
        } else if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture')) {
            onSuccess(paymentIntent.id);
            setClicking(false);
        } else {
            onError('Payment is processing. Check your trips shortly.');
            setClicking(false);
        }
    }, [stripe, elements, onSuccess, onError]);

    return (
        <>
            <div style={{ background: palette.surface, borderRadius: 12, padding: 'clamp(20px,3vw,36px)', paddingBottom: 'clamp(18px,2.4vw,28px)', marginBottom: 25 }}>
                <PaymentElement options={{
                    layout: 'accordion',
                    ...(country ? { defaultValues: { billingDetails: { address: { country } } } } : {}),
                }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 'clamp(20px,3vw,32px)', fontSize: 12, color: palette.muted }}>
                    <span>{t.rich('securedPoweredBy', { brand: 'Stripe', b: (chunks) => <b style={{ color: palette.soft, fontWeight: 700 }}>{chunks}</b> })}</span>
                </div>
            </div>
            <PrimaryBtn onClick={handlePay} loading={submitting || clicking} disabled={!stripe || !elements}>
                {t('payNow', { amount: `${currency} ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}` })}
            </PrimaryBtn>
        </>
    );
}
```

(This drops the `setSubmitting` prop entirely — nothing inside the component calls it anymore.)

- [ ] **Step 4: Stop feeding the page's `submitting` into the hotel path, and drop the now-dead `hotelSubmitting` alias**

Find this line (around 939):

```tsx
    const hotelSubmitting = submitting || hotel.busy;
```

Delete it. It was only ever `hotel.busy` in practice — nothing in the hotel path ever set the page's `submitting` except `StripePaymentForm`, which no longer does.

Then replace every remaining use of `hotelSubmitting` with `hotel.busy` directly. There are two: the "Continue to payment" button (around line 1588):

```tsx
                                <div style={{ marginTop: 40 }}>
                                    <PrimaryBtn onClick={handleHotelSubmitForm} loading={hotel.busy} disabled={!hotel.canSubmit}>
                                        {t('continueToPayment')}
                                    </PrimaryBtn>
                                </div>
```

And the hotel's `StripePaymentForm` instance (around line 1596–1607) — drop `setSubmitting` and pass `hotel.busy` as `submitting`:

```tsx
                        {step === 'payment' && hotelState.clientSecret && (
                            <Elements stripe={getStripe()} options={{ clientSecret: hotelState.clientSecret, appearance: stripeAppearance(palette, theme) }}>
                                <StripePaymentForm
                                    onSuccess={handleStripeSuccess}
                                    onError={handleStripeError}
                                    total={total}
                                    currency={shownCurrency}
                                    submitting={hotel.busy}
                                    palette={palette}
                                />
                            </Elements>
                        )}
```

- [ ] **Step 5: Drop the now-unused `setSubmitting` prop from the flight call site too**

Around line 1374–1380, the flight instance of `StripePaymentForm` still passes `setSubmitting` — remove it (the prop no longer exists on the component):

```tsx
                                        <StripePaymentForm
                                            onSuccess={handleStripeSuccess}
                                            onError={handleStripeError}
                                            total={totalAmount}
                                            currency={flightCurrency}
                                            country={passengers[0]?.country}
                                            submitting={submitting}
                                            palette={palette}
                                        />
```

(Flight's own loading signal is unchanged: the page's `submitting`, already correctly set/reset by `handleFlightSubmit`/`handleFlightPaid`, composed with the component's new local `clicking` for the brief window before those take over.)

- [ ] **Step 6: Run the new test, then the full hotel and flight checkout suites**

Run: `npx vitest run src/__tests__/checkout-hotel-page.test.tsx src/__tests__/checkout-flight-page.test.tsx`
Expected: PASS, including the new test. (The flight suite will still show its two unrelated pre-existing import failures from Task 0, Step 3 — confirm no *new* failures.)

- [ ] **Step 7: Commit**

```bash
git add "src/app/[locale]/checkout/page.tsx" src/__tests__/checkout-hotel-page.test.tsx
git commit -m "fix(checkout): stop sharing the page's submitting flag with the hotel Pay button"
```

---

### Task 2: Stop showing a confirmed-and-charged booking as "failed" (Critical #2)

**The bug:** when the API's database save after a successful supplier booking + card capture fails, it answers with `{ success: false, providerConfirmed: true, error, data: { bookingId } }` — no `needsReview` flag. `classifyConfirmResponse` has no branch for `providerConfirmed === true` on its own, so it falls through to the final `{ kind: 'failed', released: false }`. The traveller is told the booking failed and to check Trips, but there's no `bookings` row to show there, and nothing stops them retrying — which would double-book and double-charge.

**Files:**
- Modify: `src/features/checkout/lib/checkout-errors.ts:157-181` (`classifyConfirmResponse`)
- Test: `src/features/checkout/lib/__tests__/checkout-errors.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe('classifyConfirmResponse', ...)` block in `src/features/checkout/lib/__tests__/checkout-errors.test.ts`, after the existing `'treats a booking made but not paid for as review, never as a failure to retry'` test:

```ts
    it('is review, not failed, when the provider confirmed but saving the booking failed', () => {
        const out = classifyConfirmResponse({
            success: false, providerConfirmed: true, error: 'DB write failed', data: { bookingId: 'CG-ABC123' },
        });
        expect(out).toMatchObject({ kind: 'needs_review', reference: 'CG-ABC123' });
    });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/checkout/lib/__tests__/checkout-errors.test.ts -t "saving the booking failed"`
Expected: FAIL — `out.kind` is `'failed'`, not `'needs_review'`.

- [ ] **Step 3: Add the missing branch**

In `src/features/checkout/lib/checkout-errors.ts`, inside `classifyConfirmResponse`, insert a new branch right before the final `return { kind: 'failed', ... }` (i.e. after the existing `errorCode === 'price_changed'` branch):

```ts
    // The supplier confirmed the room and the card was captured; only recording it afterward
    // failed. That is not a "no" — the booking exists, so this is followed up, never retried.
    if (body.providerConfirmed === true) {
        return {
            kind: 'needs_review', reference: body.reference ?? body.data?.bookingId,
            message: "Your booking was confirmed, but we're still finishing up on our end. We'll be in touch shortly — please don't book again.",
        };
    }

    // Only a definitive "no" releases the money. A body that says nothing either way is not
    // grounds to tell someone they have not been charged.
    return { kind: 'failed', message, released: body.providerConfirmed === false };
```

- [ ] **Step 4: Run the test file**

Run: `npx vitest run src/features/checkout/lib/__tests__/checkout-errors.test.ts`
Expected: PASS, all tests (including the pre-existing ones — the `providerConfirmed: true, needsReview: true` case still hits the earlier `needsReview` branch unchanged).

- [ ] **Step 5: Run the hotel checkout page test too, since it exercises this through the real page**

Run: `npx vitest run src/__tests__/checkout-hotel-page.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/checkout/lib/checkout-errors.ts src/features/checkout/lib/__tests__/checkout-errors.test.ts
git commit -m "fix(checkout): a booking the supplier confirmed is review, never failed"
```

---

### Task 3: Fix the currency-mismatched price-change guard (Critical #3)

**The bug:** at booking-confirm time, the API compares `tgxPrice` (the supplier's price from the *just-completed* booking, in whatever currency the supplier quoted) against `params.quotedPrice` — a number the **app** sends, computed as the browser's own FX-converted display total, in the traveller's **shopping** currency. These are not reliably the same currency. After a currency switch, or whenever the supplier's booking-time currency differs from the display currency, the comparison is apples-to-oranges: `tgxPrice > quotedPrice * 1.05` can trip on every booking (false positive, needless `needs_review`) or never trip at all (false negative, the one thing this guard exists to catch).

**The fix does not need external confirmation about which currencies TravelgateX quotes in** — investigation found the API already records a same-request, same-currency reference: `preBook()` saves the supplier's quote (`net`, `gross`, `currency`) via `this.repo.savePrebookQuote(...)`, keyed by `prebookId`, specifically so `createPayment()` can charge from it instead of the client's figure (see `hotels.service.ts:701`, `resolveHotelChargeBase`). `confirmBooking()` already has `params.prebookId` — it just never looked the stored quote up. Comparing the just-booked `tgxPrice` against *that* stored quote (converting currencies only if they differ, using the same strict converter `createPayment` already uses) replaces a client-supplied guess with the server's own prior answer, in `hotels.service.ts`, in the API repo.

**Files (API repo — `cheapestgo-api-v2-nearby`):**
- Modify: `src/services/hotels.service.ts:983-993` (the price-change guard inside `confirmBooking`)
- Test: wherever `confirmBooking`'s existing tests live (find with `grep -rn "confirmBooking" src/ --include="*.test.ts"` from the API repo root) — add alongside them

**Files (app repo — this repo):**
- Modify: `src/features/checkout/lib/hotel-checkout-api.ts:96-99, 118` (stop sending `quotedPrice`)
- Test: `src/features/checkout/lib/__tests__/hotel-checkout-api.test.ts`

- [ ] **Step 1 (API repo): Find the existing confirm tests and the exact shape of a test double for `this.repo`**

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-api-v2-nearby
grep -rln "confirmBooking" src/ --include="*.test.ts"
```

Open whatever that finds, read how `this.repo` and `this.provider` are stubbed for a `confirmBooking` test (in particular, how a successful `provider.book()` response with a `price` is constructed, and how `this.repo` is typically a plain object of `vi.fn()`s). Match that style exactly for the new test below — do not introduce a different mocking convention.

- [ ] **Step 2 (API repo): Write the failing test**

Using the mocking convention found in Step 1, add a test (in the same file as the existing `confirmBooking` tests) that:
- Stubs `this.repo.findPrebookQuote` to resolve `{ gross: 100, currency: 'USD', expires_at: <a date in the future> }`.
- Stubs `this.provider.book` to resolve a booking whose `price` is `{ net: 500000, gross: 550000, currency: 'KRW' }` — a price that is numerically huge in KRW but is *not* actually a >5% increase once converted to USD (e.g. roughly $100 USD at a ~5500 KRW/USD rate — adjust the exact numbers to whatever rate your test's FX stub returns, so the "same-currency, correctly converted" math comes out under the 5% threshold).
- Stubs whatever exchange-rate dependency `resolveHotelChargeBase`/`createPayment`'s tests already use the same way those tests do, rather than inventing a new stub shape.
- Calls `confirmBooking` with `quotedPrice` **omitted** (proving the guard no longer depends on it).
- Asserts the booking is **not** flagged as `price_changed` — i.e. the response does not have `errorCode: 'price_changed'`.

Run it (`npx vitest run <that file> -t <your test name>`) and confirm it currently **fails** — with `quotedPrice` omitted, today's code skips the guard entirely (`if (params.quotedPrice && ...)` is false), so this specific assertion might accidentally pass today. If it does, invert the proof: also assert that `this.repo.findPrebookQuote` **was called** with the `prebookId`, which today's code never does. That assertion is the one that must fail first.

- [ ] **Step 3 (API repo): Fix the guard**

In `src/services/hotels.service.ts`, replace lines 983–993 (currently):

```ts
        const tgxPrice = booking.price?.gross || booking.price?.net || 0; // supplier cost

        // Price change guard (>5%)
        if (params.quotedPrice && params.quotedPrice > 0 && tgxPrice > 0) {
            if (tgxPrice > params.quotedPrice * 1.05) {
                console.warn(`[confirm] Price increased beyond threshold: quoted=${params.quotedPrice} booked=${tgxPrice}`);
                // The supplier has already booked, so this is not a clean "no": it needs a person.
                if (paidReference && claimed) {
                    await this.lifecycle.flagPriceMoved(paidReference, params.quotedPrice, tgxPrice, actor);
                }
                return { success: false, errorCode: 'price_changed', oldPrice: params.quotedPrice, newPrice: tgxPrice };
            }
        }
```

with:

```ts
        const tgxPrice = booking.price?.gross || booking.price?.net || 0; // supplier cost
        const tgxCurrency = (booking.price?.currency || currency).toUpperCase();

        // Price change guard (>5%). Compared against the supplier's own quote recorded at
        // prebook — never the client's figure (ADR-0021) — converted into the booking's own
        // currency only if the two differ. A missing or expired stored quote skips the guard,
        // same as today when no comparison figure is available at all: the booking has already
        // been made with the supplier by this point, so there is nothing safer to do than let
        // it stand.
        let guardQuote: { gross: number; currency: string } | null = null;
        if (tgxPrice > 0) {
            const stored = await this.repo.findPrebookQuote(params.prebookId);
            if (stored) {
                const storedCurrency = String(stored.currency).toUpperCase();
                if (storedCurrency === tgxCurrency) {
                    guardQuote = { gross: stored.gross, currency: tgxCurrency };
                } else {
                    try {
                        const rates = await new ExchangeRatesService().getLiveRates();
                        const gross = makeStrictConverter(rates)(stored.gross, storedCurrency, tgxCurrency);
                        guardQuote = { gross, currency: tgxCurrency };
                    } catch (fxErr: any) {
                        console.warn('[confirm] price-guard FX conversion unavailable:', fxErr?.message);
                    }
                }
            }
        }

        if (guardQuote && guardQuote.gross > 0 && tgxPrice > 0) {
            if (tgxPrice > guardQuote.gross * 1.05) {
                console.warn(`[confirm] Price increased beyond threshold: quoted=${guardQuote.gross} ${guardQuote.currency} booked=${tgxPrice} ${tgxCurrency}`);
                // The supplier has already booked, so this is not a clean "no": it needs a person.
                if (paidReference && claimed) {
                    await this.lifecycle.flagPriceMoved(paidReference, guardQuote.gross, tgxPrice, actor);
                }
                return { success: false, errorCode: 'price_changed', oldPrice: guardQuote.gross, newPrice: tgxPrice };
            }
        }
```

Check the top of `hotels.service.ts` for existing imports of `ExchangeRatesService` and `makeStrictConverter` (both are already imported for `createPayment`, around the top of the file and at line 706/712) — reuse those imports, don't add duplicates.

- [ ] **Step 4 (API repo): Run the test, then the full hotel service test suite**

```bash
npx vitest run <the confirmBooking test file>
npx vitest run src/services  # or whatever the project's test script targets for this service
```

Expected: PASS, including your new test and every pre-existing `confirmBooking` test (the ones that *do* pass `quotedPrice` in same-currency scenarios should be unaffected, since `storedCurrency === tgxCurrency` is the common case and skips FX entirely).

- [ ] **Step 5 (API repo): Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors introduced by this change.

- [ ] **Step 6 (API repo): Commit**

```bash
cd /c/Users/USER/Documents/GitHub/cheapestgo-api-v2-nearby
git add src/services/hotels.service.ts <the test file you edited>
git commit -m "fix(hotels): compare the confirm-time price against the server's own quote, not the client's"
```

- [ ] **Step 7 (app repo): Write the failing test for no longer sending `quotedPrice`**

Back in this repo (`cheapestgo-app-v2-nearby`). Open `src/features/checkout/lib/__tests__/hotel-checkout-api.test.ts`, find an existing test of `confirmHotelBooking` or `createHotelPayment` that inspects the request body (match its exact style), and add:

```ts
    it('does not send quotedPrice — the API compares against its own recorded quote', async () => {
        const client = { post: vi.fn(async () => ({ data: { bookingId: 'CG-1', status: 'confirmed' } })), get: vi.fn() };
        await confirmHotelBooking(client, {
            paymentIntentId: 'pi_1',
            quote: { prebookId: 'MOCK:abc' },
            guest: { holder: { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' }, guests: [] },
            stay: { hotelName: 'H', roomName: 'R', hotelImage: '', checkIn: '2026-11-10', checkOut: '2026-11-12', adults: 2, children: 0, currency: 'USD' },
            placeholderTotal: 238,
        });

        const body = client.post.mock.calls[0][1] as Record<string, unknown>;
        expect(body).not.toHaveProperty('quotedPrice');
    });
```

(Adjust the exact shape of `quote`/`guest`/`stay` to whatever minimal fixture the file's other tests already use — don't invent a new fixture shape if one exists.)

Run: `npx vitest run src/features/checkout/lib/__tests__/hotel-checkout-api.test.ts -t "does not send quotedPrice"`
Expected: FAIL — `quotedPrice` is currently present.

- [ ] **Step 8 (app repo): Stop sending it**

In `src/features/checkout/lib/hotel-checkout-api.ts`, in the `stayBody` function, delete this line:

```ts
        ...(placeholderTotal > 0 ? { quotedPrice: placeholderTotal } : {}),
```

Update the `CallInput.placeholderTotal` doc comment just above (currently describing it as "sent only as the confirm call's `quotedPrice` guard") — it's no longer sent at all now; simplify to:

```ts
    /**
     * The room total the page arrived with. Kept only for the checkout UI's own display —
     * never sent to the server. The server compares its own recorded prebook quote against
     * what the supplier actually booked; see api-v2's `confirmBooking`.
     */
    placeholderTotal: number;
```

- [ ] **Step 9 (app repo): Run the test, then the full hotel checkout suite**

Run: `npx vitest run src/features/checkout/lib/__tests__/hotel-checkout-api.test.ts src/__tests__/checkout-hotel-page.test.tsx`
Expected: PASS.

- [ ] **Step 10 (app repo): Typecheck, then commit**

```bash
npx tsc --noEmit
git add src/features/checkout/lib/hotel-checkout-api.ts src/features/checkout/lib/__tests__/hotel-checkout-api.test.ts
git commit -m "fix(checkout): stop sending a client-computed price as the server's confirm-time guard"
```

---

### Task 4: Redundant `decodeURIComponent` on an already-decoded param

**The bug:** `useParams()` already URL-decodes route params. `BookingStatusView` decodes again — harmless for a normal reference, but a reference containing a literal `%` would throw inside `decodeURIComponent`.

**Files:**
- Modify: `src/features/checkout/components/booking-status-view.tsx:133`
- Test: whatever test file covers `BookingStatusView` (`grep -rln "BookingStatusView" src/ --include="*.test.tsx"`)

- [ ] **Step 1: Write the failing test**

In the test file found above, add (matching its existing render/mock conventions for `useParams`):

```tsx
    it('does not throw on a reference containing a literal percent sign', async () => {
        vi.mocked(useParams).mockReturnValue({ reference: 'CG-AB%43' } as never);
        expect(() => renderPage()).not.toThrow();
    });
```

(Match the actual mock/import names and render helper already used in that file — read it first and mirror its style exactly.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run <that test file> -t "literal percent sign"`
Expected: FAIL — `decodeURIComponent('CG-AB%43')` throws `URIError: URI malformed`.

- [ ] **Step 3: Remove the redundant decode**

In `src/features/checkout/components/booking-status-view.tsx`, change:

```ts
    const reference = decodeURIComponent(params?.reference ?? '');
```

to:

```ts
    const reference = params?.reference ?? '';
```

- [ ] **Step 4: Run the test, then the full file**

Run: `npx vitest run <that test file>`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/components/booking-status-view.tsx <the test file>
git commit -m "fix(checkout): stop double-decoding a route param useParams already decoded"
```

---

### Task 5: De-duplicate the hotel/flight status-badge maps

**The bug:** `HOTEL_STATUS_MAP`/`FLIGHT_STATUS_MAP` in `booking-card.tsx` and `HOTEL_STATUS`/`FLIGHT_STATUS` in `booking-detail.tsx` are two independently-maintained copies of the same status→label/color mapping (one with an `icon` field, one without). A status added to one and not the other silently shows the wrong badge in whichever screen was missed.

**Files:**
- Create: `src/features/trips/lib/status-badges.ts`
- Modify: `src/features/trips/components/booking-card.tsx`
- Modify: `src/features/trips/components/booking-detail.tsx`
- Test: `src/features/trips/lib/__tests__/status-badges.test.ts` (new)

- [ ] **Step 1: Write the failing test for the new shared module**

Create `src/features/trips/lib/__tests__/status-badges.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HOTEL_STATUS, FLIGHT_STATUS } from '../status-badges';

describe('status-badges', () => {
    it('has a label and a color for every hotel status booking-card and booking-detail both render', () => {
        for (const status of ['pending', 'confirmed', 'completed', 'cancelled', 'cancelled_refunded', 'cancelled_refund_failed']) {
            expect(HOTEL_STATUS[status]).toMatchObject({ label: expect.any(String), color: expect.any(String) });
        }
    });

    it('has a label and a color for every flight status', () => {
        for (const status of ['booked', 'pnr_created', 'awaiting_ticket', 'ticketed', 'failed', 'cancel_requested', 'cancel_failed', 'cancelled', 'refund_pending', 'refund_failed', 'refunded', 'cancelled_provider_missing']) {
            expect(FLIGHT_STATUS[status]).toMatchObject({ label: expect.any(String), color: expect.any(String) });
        }
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/trips/lib/__tests__/status-badges.test.ts`
Expected: FAIL — `../status-badges` does not exist yet.

- [ ] **Step 3: Create the shared module**

First read the full `HOTEL_STATUS`/`FLIGHT_STATUS` constants in `booking-detail.tsx` (lines 27–50ish — it carries an `icon: React.ReactNode` field the `booking-card.tsx` version doesn't) and the plain `HOTEL_STATUS_MAP`/`FLIGHT_STATUS_MAP` in `booking-card.tsx` (lines 13–35ish, label+color only). Create `src/features/trips/lib/status-badges.ts` exporting the **superset** shape (label, color, and icon), e.g.:

```ts
import React from 'react';
import { Clock, CheckCircle, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';

export interface StatusBadgeConfig {
    label: string;
    color: string;
    icon: React.ReactNode;
}

export const HOTEL_STATUS: Record<string, StatusBadgeConfig> = {
    // Copy the exact entries from booking-detail.tsx's current HOTEL_STATUS here, verbatim —
    // it already has the icon field booking-card.tsx's map lacks.
};

export const FLIGHT_STATUS: Record<string, StatusBadgeConfig> = {
    // Copy the exact entries from booking-detail.tsx's current FLIGHT_STATUS here, verbatim.
};
```

(This plan does not hand-copy the full object literals here since they must match whatever is on disk at execution time byte-for-byte, including any statuses added since this review — read both files fresh and reconcile any statuses that appear in one map but not the other before merging. If the two maps disagree on label/color for the same status, that disagreement is itself a bug: flag it rather than silently picking one.)

- [ ] **Step 4: Point both components at the shared module**

In `booking-detail.tsx`, delete the local `HOTEL_STATUS`/`FLIGHT_STATUS` constants and add:
```ts
import { HOTEL_STATUS, FLIGHT_STATUS } from '../lib/status-badges';
```

In `booking-card.tsx`, delete the local `HOTEL_STATUS_MAP`/`FLIGHT_STATUS_MAP` constants, add the same import, and rename every use of `HOTEL_STATUS_MAP`/`FLIGHT_STATUS_MAP` in that file to `HOTEL_STATUS`/`FLIGHT_STATUS` (it will now render an icon it previously didn't — check visually/in its test that this doesn't break its layout; if `booking-card.tsx`'s badge markup has no slot for an icon, destructure only `{ label, color }` from the shared config at the call site rather than changing its JSX).

- [ ] **Step 5: Run the new test and both components' existing tests**

Run: `npx vitest run src/features/trips/lib/__tests__/status-badges.test.ts src/features/trips/components/__tests__/trips-contract.test.tsx`
Expected: PASS. (Check for a `booking-card.test.tsx`/`booking-detail.test.tsx` too — `find src/features/trips -iname "*booking-card*" -o -iname "*booking-detail*"` — and run those as well if they exist.)

- [ ] **Step 6: Typecheck, then commit**

```bash
npx tsc --noEmit
git add src/features/trips/lib/status-badges.ts src/features/trips/lib/__tests__/status-badges.test.ts src/features/trips/components/booking-card.tsx src/features/trips/components/booking-detail.tsx
git commit -m "refactor(trips): one status-badge map for hotel and flight bookings, not two"
```

---

### Task 6: Fix the guest-count mismatch between the receipt and the summary

**The bug:** the hotel confirmation receipt shows only `adults` as the guest count (`page.tsx:632`); the booking summary sidebar on the same page shows `adults + children` (`page.tsx:1170`). A 2-adult-1-child booking shows "2 guests" on the receipt and "3 guests" on the summary a screen away.

**Files:**
- Modify: `src/app/[locale]/checkout/page.tsx:632`
- Test: `src/__tests__/checkout-hotel-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/checkout-hotel-page.test.tsx`, in a `describe` block covering the confirmed receipt (find the existing `'shows the booking\'s own reference once confirmed'` test and add alongside it):

```tsx
    it('counts children in the receipt\'s guest count, same as the summary', async () => {
        await toPayment({ children: '1' });
        fireEvent.change(screen.getByPlaceholderText('0–17'), { target: { value: '5' } });
        proceed();
        fireEvent.click(await screen.findByRole('button', { name: /pay usd/i }));

        await screen.findByText('CG-ABC123');
        expect(screen.getByText(/3 guests/i)).toBeInTheDocument();
    });
```

(Confirm the exact translation output for `guestsCount` with count 3 by checking `en.json`'s `checkout.guestsCount` ICU plural string — adjust the matcher text to whatever it actually renders if not literally "3 guests".)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/checkout-hotel-page.test.tsx -t "counts children in the receipt"`
Expected: FAIL — the receipt shows "2 guests" (adults only).

- [ ] **Step 3: Fix it**

In `src/app/[locale]/checkout/page.tsx` at line 632, change:

```tsx
                                <div style={{ fontSize: 11, color: palette.muted, marginTop: 2 }}>{t('guestsCount', { count: adults })}</div>
```

to:

```tsx
                                <div style={{ fontSize: 11, color: palette.muted, marginTop: 2 }}>{t('guestsCount', { count: adults + children })}</div>
```

- [ ] **Step 4: Run the test, then the full hotel checkout suite**

Run: `npx vitest run src/__tests__/checkout-hotel-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/[locale]/checkout/page.tsx" src/__tests__/checkout-hotel-page.test.tsx
git commit -m "fix(checkout): the hotel receipt counts children in its guest total, like the summary does"
```

---

### Task 7: Fix the special-requests length-limit inconsistency

**The bug:** `SPECIAL_REQUESTS_MAX = 500` governs the special-requests field at checkout (`hotel-guest-form.ts:40`); the equivalent field for editing an existing booking in Trips hardcodes `maxLength={1000}` (`booking-self-service.tsx:68`). The same field on the same booking allows twice as much text after booking as before it.

**Files:**
- Modify: `src/features/trips/components/booking-self-service.tsx:68`
- Test: `src/features/trips/components/__tests__/booking-self-service.test.tsx`

- [ ] **Step 1: Write the failing test**

Open `src/features/trips/components/__tests__/booking-self-service.test.tsx`, find how the special-requests field is rendered/queried in existing tests, and add:

```tsx
    it('caps special requests at the same length checkout does', () => {
        render(/* however the existing tests in this file render the component under test */);
        const textarea = screen.getByPlaceholderText(/* whatever placeholder/label the existing tests use to find this field */);
        expect(textarea).toHaveAttribute('maxLength', '500');
    });
```

(This step's exact render/query must mirror whatever the file's existing tests already do — read the file first; don't invent a different render helper.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/features/trips/components/__tests__/booking-self-service.test.tsx -t "same length checkout does"`
Expected: FAIL — `maxLength` is `1000`.

- [ ] **Step 3: Fix it**

In `src/features/trips/components/booking-self-service.tsx`, import the constant instead of hardcoding a different number:

```ts
import { SPECIAL_REQUESTS_MAX } from '@/features/checkout/lib/hotel-guest-form';
```

Then change line 68 from:

```tsx
                    maxLength={1000}
```

to:

```tsx
                    maxLength={SPECIAL_REQUESTS_MAX}
```

(Confirm `SPECIAL_REQUESTS_MAX` is actually exported from `hotel-guest-form.ts` — the grep in this plan's research found `export const SPECIAL_REQUESTS_MAX = 500;` at line 40, so it should be; if not, export it there first.)

- [ ] **Step 4: Run the test, then the full file**

Run: `npx vitest run src/features/trips/components/__tests__/booking-self-service.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/trips/components/booking-self-service.tsx src/features/trips/components/__tests__/booking-self-service.test.tsx
git commit -m "fix(trips): cap special requests at the same length as checkout, not twice it"
```

---

### Task 8: Don't label a penalty date as "free cancellation until" on a non-refundable booking

**The bug:** `freeCancelDeadline = policy?.cancelPolicyInfos?.[0]?.cancelTime` unconditionally reads the first entry of `cancelPolicyInfos` and shows it as "Free cancellation until {date}" — but that array has no field marking an entry as the free-cancellation boundary versus a penalty tier. For a non-refundable (NRFN) policy, index 0 is the *first penalty* date, not a free-cancellation date, and `booking-detail.tsx` shows it mislabeled as free.

**Files:**
- Modify: `src/features/trips/components/booking-detail.tsx:106, 181-188`
- Test: `find src/features/trips -iname "*booking-detail*test*"` (add there; create `src/features/trips/components/__tests__/booking-detail.test.tsx` if none exists, matching the render conventions of `src/features/trips/components/__tests__/hotel-cancel-modal.test.tsx`)

- [ ] **Step 1: Write the failing test**

```tsx
    it('does not call a non-refundable booking\'s penalty date "free cancellation"', () => {
        const booking = {
            /* ...minimum valid HotelBooking fixture, matching whatever shape
               hotel-cancel-modal.test.tsx's fixture already uses... */
            cancellation_policy: {
                refundableTag: 'NRFN',
                cancelPolicyInfos: [{ cancelTime: '2026-11-01T00:00:00Z', amount: 50, currency: 'USD' }],
            },
        };
        render(/* however this file's other tests render HotelDetail/booking-detail with a fixture */);
        expect(screen.queryByText(/free cancellation until/i)).not.toBeInTheDocument();
    });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run <the booking-detail test file> -t "free cancellation"`
Expected: FAIL — the text renders regardless of `refundableTag`.

- [ ] **Step 3: Gate the "free until" text on the policy actually being refundable**

In `src/features/trips/components/booking-detail.tsx`, the block at lines 181–188 currently reads:

```tsx
                    {freeCancelDeadline && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Free cancellation until{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {fmtDate(freeCancelDeadline, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                        </p>
                    )}
```

Change the condition to also require `refundable` (already computed two lines above `freeCancelDeadline` as `policy?.refundableTag === 'RFN'`):

```tsx
                    {refundable && freeCancelDeadline && (
```

- [ ] **Step 4: Run the test, then the full file**

Run: `npx vitest run <the booking-detail test file>`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/trips/components/booking-detail.tsx <the test file>
git commit -m "fix(trips): don't show a non-refundable booking's penalty date as free cancellation"
```

---

### Task 9: Fix the price-change panel's possible permanent "refreshing" state

**The bug:** `PriceMovedPanel`'s `waiting = refreshing || !change` disables the Accept button and shows "refreshing…" whenever `change` is absent — including when `refreshing` (`hotel.busy`) is already back to `false` but a fresh quote simply didn't come back with a `priceChange` field this time. The traveller sees a permanently disabled Accept button with no way out except "choose another room".

**Files:**
- Modify: `src/features/checkout/components/booking-state-panels.tsx:118, 120-143`
- Test: `find src/features/checkout/components -iname "*booking-state-panels*test*"`

- [ ] **Step 1: Write the failing test**

In the `booking-state-panels` test file (match its existing render conventions for `PriceMovedPanel`):

```tsx
    it('offers a way forward instead of a stuck disabled button when the price-change figure never arrives', () => {
        render(
            <PriceMovedPanel
                palette={/* whatever palette fixture this file's other PriceMovedPanel tests use */}
                refreshing={false}
                onAccept={vi.fn()}
                onChooseAnother={vi.fn()}
            />
        );
        // Not stuck saying "refreshing" when nothing is actually in flight.
        expect(screen.queryByText(/refreshing/i)).not.toBeInTheDocument();
    });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run <the booking-state-panels test file> -t "stuck disabled button"`
Expected: FAIL — `waiting = false || !undefined = true`, so "refreshing…" renders even though `refreshing` is `false`.

- [ ] **Step 3: Separate "actively refreshing" from "nothing to show"**

In `src/features/checkout/components/booking-state-panels.tsx`, change:

```tsx
    const waiting = refreshing || !change;
```

to:

```tsx
    const waiting = !!refreshing;
    const stuck = !refreshing && !change;
```

Then update the render to give `stuck` its own message instead of silently reusing "refreshing" text, and to let the traveller move on rather than stare at a disabled Accept button. Change:

```tsx
            {waiting && <Body palette={palette}>{t('priceMoved.refreshing')}</Body>}
            <Actions>
                <Button palette={palette} onClick={onAccept} disabled={waiting}>{t('priceMoved.accept')}</Button>
                <Button palette={palette} kind="quiet" onClick={onChooseAnother}>{t('priceMoved.chooseAnother')}</Button>
            </Actions>
```

to:

```tsx
            {waiting && <Body palette={palette}>{t('priceMoved.refreshing')}</Body>}
            {stuck && <Body palette={palette}>{t('priceMoved.unavailable')}</Body>}
            <Actions>
                <Button palette={palette} onClick={onAccept} disabled={waiting || stuck}>{t('priceMoved.accept')}</Button>
                <Button palette={palette} kind="quiet" onClick={onChooseAnother}>{t('priceMoved.chooseAnother')}</Button>
            </Actions>
```

Add the new `checkout.priceMoved.unavailable` key to `src/locales/en.json` next to the existing `priceMoved.*` keys, in English only for now — e.g. `"unavailable": "We couldn't refresh the price. Please choose another room."` — and flag in the hand-off that the other three locale files need this one key translated (one short sentence, not the larger i18n task flagged elsewhere in this plan).

- [ ] **Step 4: Run the test, then the full file**

Run: `npx vitest run <the booking-state-panels test file>`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/components/booking-state-panels.tsx src/locales/en.json <the test file>
git commit -m "fix(checkout): the price-moved panel no longer gets stuck saying it's refreshing"
```

---

### Task 10: Don't let a currency switch drop an in-flight card authorisation

**The bug:** `useHotelCheckout`'s effect fires `BACK_TO_DETAILS` whenever `currency` changes while `phase === 'awaiting_payment'` — including the window after the traveller clicked Pay and `stripe.confirmPayment()` is still resolving (3DS, a redirect-based method). If it then resolves, `onCardAuthorised` dispatches into a machine that has already moved phases, and the wrong-phase guard silently drops the event: the card may be authorised with no booking ever following up on it. Minimal fix: stop the traveller from switching currency while a payment is actually open, rather than trying to make the race safe.

**Files:**
- Modify: `src/shared/components/common/CurrencySelector.tsx` (add a `disabled` prop)
- Modify: `src/app/[locale]/checkout/page.tsx` (pass it through for the hotel path only)
- Test: `src/features/landing/components/landing-header.test.tsx` or wherever `CurrencySelector` already has a test (`find src -iname "*currencyselector*test*"`); add a page-level test to `checkout-hotel-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/checkout-hotel-page.test.tsx`:

```tsx
    it('disables the currency switcher once a payment is open', async () => {
        await toPayment();
        proceed();
        await screen.findByTestId('payment-element');

        expect(screen.getByRole('button', { name: /select currency/i })).toBeDisabled();
    });
```

(Confirm the exact accessible name `CurrencySelector`'s trigger button exposes by reading its JSX — this plan's research saw an `aria-label="Select currency"` in one rendering of the app's header; match whatever this component's own trigger actually uses. The test file already mocks `@/shared/components/common/CurrencySelector` to `() => null` at the top — for *this* test you'll need the real component, so either remove that mock for this one test file section or add a second, more targeted mock that accepts and reflects a `disabled` prop; follow whichever pattern is less disruptive to the file's other tests.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/checkout-hotel-page.test.tsx -t "disables the currency switcher"`
Expected: FAIL — `CurrencySelector` has no `disabled` prop yet, and nothing passes one.

- [ ] **Step 3: Add a `disabled` prop to `CurrencySelector`**

In `src/shared/components/common/CurrencySelector.tsx`, add to `CurrencySelectorProps`:

```ts
  /** True while committing to a currency change would be unsafe — e.g. a payment is open. */
  disabled?: boolean;
```

Add it to the destructured props (default `false`), and use it to block both the click handler and the trigger button:

```ts
export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  className,
  align = 'right',
  variant = 'default',
  chrome,
  iconOnly = false,
  triggerClassName,
  disabled = false,
}) => {
```

Find the trigger `<button>` element further down this file and add `disabled={disabled}` to it, plus guard the `onClick` that opens the menu (`setIsOpen(...)`) with `if (disabled) return;` at its top.

- [ ] **Step 4: Pass it through from checkout, hotel path only**

In `src/app/[locale]/checkout/page.tsx`, `CheckoutToolbar` currently takes `{ palette, backLabel, onBack }`. Add an optional `disableCurrency?: boolean` prop, and pass it to its `<CurrencySelector disabled={disableCurrency} .../>`.

At the hotel call site (around line 1408):

```tsx
                <CheckoutToolbar palette={palette} backLabel={backLabel} onBack={handleBack} disableCurrency={step === 'payment'} />
```

Leave the flight call site unchanged (pass nothing — defaults to `false`); this bug was only diagnosed for the hotel path, which is the only one whose currency change re-quotes through this same effect.

- [ ] **Step 5: Run the test, then the full hotel checkout suite and the CurrencySelector's own tests**

Run: `npx vitest run src/__tests__/checkout-hotel-page.test.tsx <the CurrencySelector test file>`
Expected: PASS.

- [ ] **Step 6: Typecheck, then commit**

```bash
npx tsc --noEmit
git add src/shared/components/common/CurrencySelector.tsx "src/app/[locale]/checkout/page.tsx" src/__tests__/checkout-hotel-page.test.tsx
git commit -m "fix(checkout): disable the currency switcher once a hotel payment is open"
```

---

### Task 11: Give the hotel name fields real labels and ids (fixes the fragile placeholder-index test lookups too)

**The problem:** the hotel lead-guest and co-guest name `<input>`s have no `id`/`htmlFor` pairing with their `<Label>`, unlike the flight passenger fields. Today's test suite (from the uncommitted layer in Task 0) had to fall back to `getAllByPlaceholderText('John')[0]`/`[1]` to tell the lead guest's input from the co-guest's, because there's no accessible way to address them individually. That's also a real accessibility gap: a screen reader announces these inputs with no associated label at all.

**Files:**
- Modify: `src/app/[locale]/checkout/page.tsx` (hotel holder + co-guest name fields, inside `CheckoutContent`)
- Test: `src/__tests__/checkout-hotel-page.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/checkout-hotel-page.test.tsx`:

```tsx
    it('labels the lead guest and each co-guest\'s name fields so they can be found by label', async () => {
        visit({ adults: '2' });
        renderPage();
        await screen.findByText(/USD 254/);

        expect(screen.getByLabelText(/first name/i, { selector: '#guest-firstName' })).toBeInTheDocument();
        expect(screen.getByLabelText(/first name/i, { selector: '#coGuest-0-firstName' })).toBeInTheDocument();
    });
```

(Pick whatever `id` scheme you're about to introduce in Step 2 and make this test match it — the ids above are illustrative; keep them consistent with the flight form's own `id(...)` helper if one already exists nearby in this file, found via `grep -n "const id = " "src/app/[locale]/checkout/page.tsx"`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/checkout-hotel-page.test.tsx -t "labels the lead guest"`
Expected: FAIL — no element has those ids/labels yet.

- [ ] **Step 3: Add ids and `htmlFor` to the hotel holder and co-guest fields**

Find the hotel holder's name fields (around line 1499–1514, from this plan's research) and the co-guest loop (around line 1536–1550). For each `<Label>`/`<input>` pair, add a matching `id`/`htmlFor`, following the same `id(...)` pattern the flight passenger form already uses a few hundred lines above in the same file (`grep -n "const id = " "src/app/[locale]/checkout/page.tsx"` to find its exact definition and reuse the identical helper rather than inventing a second one).

For the holder:
```tsx
<Label palette={palette} icon={User} htmlFor="guest-firstName">{t('userDetails.firstName')}</Label>
<input id="guest-firstName" type="text" autoComplete="given-name" value={guest.firstName} onChange={e => onGuest('firstName', e.target.value)} placeholder={EXAMPLE_FIRST_NAME} className="cg-field" style={mkField(palette, !!fieldError('holder.firstName'))} />
```
(and the matching change for `lastName`.)

For each co-guest (inside its `.map((g, i) => ...)`):
```tsx
<Label palette={palette} icon={User} htmlFor={`coGuest-${i}-firstName`}>{t('userDetails.firstName')}</Label>
<input id={`coGuest-${i}-firstName`} type="text" value={g.firstName} onChange={e => onCoGuest(i, 'firstName', e.target.value)} placeholder={EXAMPLE_FIRST_NAME} className="cg-field" style={mkField(palette, !!fieldError(`coGuests.${i}.firstName`))} />
```
(and the matching change for `lastName`.)

(This also changes the Label text from `t('userDetails.firstNamePlaceholder')` to `t('userDetails.firstName')` — a separate finding from the same review (the hotel form was using a placeholder-text key as its actual label, unlike the flight form's `userDetails.firstName`, which renders "First Name *"). Fixed here rather than as its own task, since it's the same lines already being touched.)

- [ ] **Step 4: Update the other tests in this file that relied on placeholder-index lookups**

Now that the fields have real labels, replace the index-based lookups introduced in Task 0's uncommitted layer. In `fillHolder()`/`fillCoGuest()` and the two "ring" tests near the bottom of the file, change e.g.:

```tsx
fireEvent.change(screen.getAllByPlaceholderText('John')[0], { target: { value: 'Juan' } });
```

to:

```tsx
fireEvent.change(screen.getByLabelText(/first name/i, { selector: '#guest-firstName' }), { target: { value: 'Juan' } });
```

and similarly for the co-guest and `lastName` lookups, using the `coGuest-0-...` ids for the co-guest. Keep the flight-side lookups (if any share this file) untouched — this only affects the hotel fields.

- [ ] **Step 5: Run the new test, then the whole file**

Run: `npx vitest run src/__tests__/checkout-hotel-page.test.tsx`
Expected: PASS, all tests — including the ones just rewritten to use labels instead of placeholder indices.

- [ ] **Step 6: Commit**

```bash
git add "src/app/[locale]/checkout/page.tsx" src/__tests__/checkout-hotel-page.test.tsx
git commit -m "fix(checkout): give hotel name fields real id/label pairs instead of bare placeholders"
```

---

### Hand-off

After Task 11, run the full suite once more end to end and confirm the overall pass count only improved:

```bash
npx vitest run
npx tsc --noEmit
```

(`flight-summary-card.test.tsx` and `flight-itinerary.test.tsx` will still fail — pre-existing, unrelated to this plan, caused by two files from an earlier unrelated commit that were never added. Confirm those are the *only* failures.)

**Not done here, flagged for separate follow-up:**
- The 9 **Important**-severity findings from the 2026-10-21 review were not in scope for "critical + minor." The most concrete and independently re-verified one: `outcomeFromStatus` in `hotel-checkout-api.ts` (lines 194–201) maps `CANCELLED`, `CANCEL_REQUESTED`, `REFUND_PENDING`, `REFUNDED`, and `REFUND_FAILED` all to `{ kind: 'confirmed' }` — a cancelled booking reached via `/booking/[reference]` shows as a green "Booked." This is a real, user-facing correctness bug and probably deserves its own short plan before the others.
- Hardcoded English UI strings in the hotel trips screens (`booking-detail.tsx` and others) — a real i18n gap, but sized like its own task (15+ new keys × 4 languages, needing real translations).
- Hardcoded `'en-US'` date/currency formatting — found to be systemic: `src/shared/lib/format.ts` itself hardcodes `'en-US'` and is not locale-aware. Fixing this properly means threading the active locale through a utility used across the whole app, not a hotel-booking-specific fix.
