'use client';

/**
 * The hotel checkout, as one hook.
 *
 * Composes the three things that were tangled through the page: the state machine
 * (`hotel-checkout-machine`), the conversation with api-v2 (`hotel-checkout-api`), and the
 * handling of what a failure means (`checkout-errors`). The page is left with presentation —
 * it renders `state.phase` and calls the handlers this returns.
 *
 * Three behaviours worth knowing:
 *
 *  - **It asks for a quote on arrival and again whenever the stay or currency changes**, and
 *    ignores the answer to any request that has been overtaken. A currency picked from the
 *    toolbar mid-request used to be able to land the *old* currency's figures on screen.
 *  - **It only sends an `expectedTotal` the server itself showed the traveller.** The URL's
 *    `totalPrice` is the browser's own arithmetic over client-side rates; comparing the
 *    server's quote against that would announce a "price change" whenever two exchange-rate
 *    sources disagreed by a cent.
 *  - **A confirm whose answer is lost is followed up, not retried.** The booking reference is
 *    known from the moment the payment is created, so a dropped response becomes a poll of
 *    the status endpoint — never a second confirm, which is how a stranger's room gets booked
 *    twice.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { http } from '@/shared/lib/http';
import { classifyCheckoutError, type ConfirmOutcome } from '../lib/checkout-errors';
import {
    canSubmitDetails,
    hotelCheckoutReducer,
    INITIAL_HOTEL_CHECKOUT,
    isBusy,
    type HotelCheckoutState,
} from '../lib/hotel-checkout-machine';
import {
    confirmHotelBooking,
    createHotelPayment,
    fetchBookingOutcome,
    requestQuote,
    type CheckoutHttp,
    type StayDetails,
} from '../lib/hotel-checkout-api';
import type { HotelGuestPayload } from '../lib/hotel-guest-form';

export interface UseHotelCheckoutOptions {
    /** Nothing is requested until this is true (a flight checkout shares the page). */
    enabled:          boolean;
    rateKey:          string;
    stay:             StayDetails;
    /** The room total the page arrived with — a placeholder, see `checkoutMoney`. */
    placeholderTotal: number;
    /**
     * A total, in `stay.currency`, that the traveller was shown and that was **not** converted
     * in the browser. Omit it when in doubt: a missing comparison is silent, a wrong one is a
     * false alarm at the moment someone is about to pay.
     */
    initialExpectedTotal?: number;
    client?:   CheckoutHttp;
    /** How often a settling booking is asked about, and how many times before giving up. */
    pollMs?:   number;
    maxPolls?: number;
}

export interface UseHotelCheckout {
    state:        HotelCheckoutState;
    busy:         boolean;
    canSubmit:    boolean;
    /** Ask for a quote again — after an outage, or to refresh a price. */
    refreshQuote: () => Promise<void>;
    acceptPrice:  () => void;
    /** Opens the payment. The guest payload is remembered for the confirm call. */
    submitDetails: (guest: HotelGuestPayload) => Promise<void>;
    /** Stripe says the card was authorised. Safe to call twice; it confirms once. */
    onCardAuthorised: (paymentIntentId: string) => Promise<void>;
    onCardError:  (message: string) => void;
    backToDetails: () => void;
}

const SETTLING_MESSAGE =
    'We are still confirming your booking with the hotel. You will not be charged twice — check your trips shortly, and we will email you.';

export function useHotelCheckout(options: UseHotelCheckoutOptions): UseHotelCheckout {
    const { enabled, rateKey, stay, placeholderTotal, initialExpectedTotal } = options;
    const client   = options.client ?? (http as unknown as CheckoutHttp);
    const pollMs   = options.pollMs ?? 2500;
    const maxPolls = options.maxPolls ?? 24;

    const [state, dispatch] = useReducer(hotelCheckoutReducer, INITIAL_HOTEL_CHECKOUT);

    // The latest of everything the async handlers close over, so they can be stable.
    const latest = useRef({ state, stay, rateKey, placeholderTotal, initialExpectedTotal, client });
    latest.current = { state, stay, rateKey, placeholderTotal, initialExpectedTotal, client };

    /** The room total the *server* last showed, with the currency it was in. */
    const shown = useRef<{ total: number; currency: string } | null>(null);
    const guestRef = useRef<HotelGuestPayload | null>(null);
    /** Bumped per request; a response is applied only if it is still the newest. */
    const generation = useRef(0);
    /**
     * Set synchronously, before anything is awaited. The reducer refuses a second event in the
     * wrong phase, but these handlers read the phase from the last *render*: two calls in the
     * same tick both see `quoted` and both reach the network. This is what stops that.
     */
    const inFlight = useRef({ pay: false, confirm: false });
    /** Polls made for the booking being settled; survives the phase changes that restart the effect. */
    const polled = useRef({ reference: '', count: 0 });

    // ── Quote ────────────────────────────────────────────────────────────────

    const refreshQuote = useCallback(async () => {
        const { stay, rateKey, state, initialExpectedTotal, client } = latest.current;
        const gen = ++generation.current;
        dispatch({ type: 'QUOTE_REQUESTED' });

        // What to compare the answer with: the figure the server last showed in this same
        // currency, or the page's own un-converted one for the very first request.
        const previous = shown.current && shown.current.currency === stay.currency
            ? (state.acceptedTotal ?? shown.current.total)
            : undefined;
        const expectedTotal = previous ?? (shown.current ? undefined : initialExpectedTotal);

        try {
            const quote = await requestQuote(client, {
                rateKey, roomName: stay.roomName, adults: stay.adults, children: stay.children,
                currency: stay.currency, expectedTotal,
            });
            if (gen !== generation.current) return;
            if (quote.display) shown.current = { total: quote.display.total, currency: quote.display.currency };
            dispatch({ type: 'QUOTE_RECEIVED', quote });
        } catch (err) {
            if (gen !== generation.current) return;
            dispatch({ type: 'QUOTE_FAILED', failure: classifyCheckoutError(err) });
        }
    }, []);

    // On arrival, and whenever what is being quoted changes.
    const { currency, roomName, adults, children } = stay;
    useEffect(() => {
        if (!enabled || !rateKey) return;

        // A payment opened in the old currency cannot be re-priced: back to the details, and the
        // quote that follows shows the new figures (the page did this in an effect of its own).
        if (latest.current.state.phase === 'awaiting_payment') dispatch({ type: 'BACK_TO_DETAILS' });
        else if (isBusy(latest.current.state) && latest.current.state.phase !== 'quoting') return;

        void refreshQuote();
    }, [enabled, rateKey, currency, roomName, adults, children, refreshQuote]);

    // ── Payment ──────────────────────────────────────────────────────────────

    const submitDetails = useCallback(async (guest: HotelGuestPayload) => {
        const { state, stay, placeholderTotal, client } = latest.current;
        if (inFlight.current.pay || !canSubmitDetails(state) || !state.quote) return;
        inFlight.current.pay = true;

        guestRef.current = guest;
        dispatch({ type: 'PAYMENT_REQUESTED' });

        try {
            const ready = await createHotelPayment(client, { quote: state.quote, guest, stay, placeholderTotal });
            // A new payment is a new thing to confirm.
            inFlight.current.confirm = false;
            dispatch({ type: 'PAYMENT_READY', ...ready });
        } catch (err) {
            const failure = classifyCheckoutError(err);
            dispatch({ type: 'PAYMENT_FAILED', failure });

            // Either way the figures on screen are stale: take the quote again so the panel that
            // explains it is showing what is true now, not what was true a minute ago.
            if (failure.kind === 'price_changed' || failure.kind === 'quote_expired') {
                void refreshQuote();
            }
        } finally {
            inFlight.current.pay = false;
        }
    }, [refreshQuote]);

    const onCardAuthorised = useCallback(async (paymentIntentId: string) => {
        const { state, stay, placeholderTotal, client } = latest.current;
        const guest = guestRef.current;
        if (inFlight.current.confirm || state.phase !== 'awaiting_payment' || !state.quote || !guest) return;

        // Once per payment, however many times the card is reported authorised. Never reset on
        // the way out: a confirm that has been sent is not sent again, whatever came back.
        inFlight.current.confirm = true;
        dispatch({ type: 'PAYMENT_AUTHORISED' });
        const reference = state.reference;

        try {
            const outcome = await confirmHotelBooking(client, {
                paymentIntentId, quote: state.quote, guest, stay, placeholderTotal,
            });
            dispatch({ type: 'CONFIRM_RESULT', outcome: withReference(outcome, reference) });
        } catch (err) {
            const failure = classifyCheckoutError(err);

            // A refusal that says nothing was booked is a refusal. Anything else — a dropped
            // connection, a 5xx — leaves the outcome unknown, and unknown is asked about.
            const definite = failure.kind === 'payment_required' || failure.kind === 'validation'
                || failure.kind === 'unavailable' || failure.kind === 'not_payable_online';
            if (reference && !definite) {
                dispatch({ type: 'CONFIRM_RESULT', outcome: { kind: 'pending', reference, message: SETTLING_MESSAGE } });
            } else {
                dispatch({
                    type: 'CONFIRM_RESULT',
                    outcome: { kind: 'failed', message: failure.message, released: false },
                });
            }
        }
    }, []);

    // ── Settling ─────────────────────────────────────────────────────────────

    const { phase, reference } = state;
    useEffect(() => {
        if ((phase !== 'pending' && phase !== 'needs_review') || !reference) return;

        // One budget per booking, not per effect run: giving up changes the phase, which
        // restarts this effect, and a fresh counter would ask the same booking all over again.
        if (polled.current.reference !== reference) polled.current = { reference, count: 0 };
        if (polled.current.count >= maxPolls) return;

        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const tick = async () => {
            if (stopped) return;
            polled.current.count += 1;
            try {
                const outcome = await fetchBookingOutcome(latest.current.client, reference);
                if (stopped) return;
                if (outcome.kind === 'confirmed' || outcome.kind === 'failed') {
                    dispatch({ type: 'CONFIRM_RESULT', outcome });
                    return;
                }
                if (outcome.kind === 'needs_review' && phase === 'pending') {
                    dispatch({ type: 'CONFIRM_RESULT', outcome });
                    return;
                }
            } catch {
                // A poll that fails says nothing about the booking; ask again.
            }
            if (polled.current.count >= maxPolls) {
                if (phase === 'pending' && !stopped) {
                    dispatch({
                        type: 'CONFIRM_RESULT',
                        outcome: { kind: 'needs_review', reference, message: SETTLING_MESSAGE },
                    });
                }
                return;
            }
            timer = setTimeout(tick, pollMs);
        };

        timer = setTimeout(tick, pollMs);
        return () => { stopped = true; if (timer) clearTimeout(timer); };
    }, [phase, reference, pollMs, maxPolls]);

    return {
        state,
        busy:      isBusy(state),
        canSubmit: canSubmitDetails(state),
        refreshQuote,
        acceptPrice:   useCallback(() => dispatch({ type: 'PRICE_ACCEPTED' }), []),
        submitDetails,
        onCardAuthorised,
        onCardError:   useCallback((message: string) => dispatch({ type: 'CARD_FAILED', message }), []),
        backToDetails: useCallback(() => dispatch({ type: 'BACK_TO_DETAILS' }), []),
    };
}

/** An outcome that does not name a booking inherits the one the payment was opened under. */
function withReference(outcome: ConfirmOutcome, reference?: string): ConfirmOutcome {
    if (!reference) return outcome;
    if ((outcome.kind === 'pending' || outcome.kind === 'needs_review') && !outcome.reference) {
        return { ...outcome, reference };
    }
    return outcome;
}
