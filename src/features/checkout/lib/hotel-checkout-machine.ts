/**
 * Where a hotel checkout is, as a state machine.
 *
 * The checkout page held this in a dozen `useState` calls — `step`, `submitting`, `errorMsg`,
 * `prebookId`, `display`, `clientSecret`, `bookingId` — and the combinations nobody had listed
 * were where it went wrong: a double-clicked Pay opened two payments, an error from one step
 * lingered into the next, and "the price changed" was an error string rather than a place the
 * traveller could be.
 *
 * This is the same journey the server tracks (`hotel_bookings`: PAYMENT_PENDING → AUTHORIZED →
 * SUPPLIER_BOOKING → CONFIRMED, or FAILED / NEEDS_REVIEW), seen from the browser. It decides
 * nothing the server does not already decide: no prices are computed here and no rule is
 * enforced here. What it does is refuse to be in a state that makes no sense — an event that
 * does not belong to the current phase is ignored, and the same state object comes back so
 * React does not re-render for it.
 *
 *   idle ─► quoting ─► quoted ─► creating_payment ─► awaiting_payment ─► confirming ─► confirmed
 *              │          ▲              │                                    │
 *              ├─► price_changed ─ accept ┘                                    ├─► pending ─► …
 *              ├─► unavailable                                                 ├─► needs_review
 *              └─► supplier_down ─ retry ─► quoting                            └─► failed
 */

import type { CheckoutFailure, ConfirmOutcome } from './checkout-errors';

/** The server's figures for a hotel checkout — api-v2 `preBook` → `display`. */
export interface HotelDisplay {
    currency:     string;
    subtotal:     number;
    taxes:        number;
    total:        number;
    serviceFee:   number;
    chargedTotal: number;
    converted:    boolean;
}

/** api-v2 `priceChange`: the price moved since the traveller was last shown one. */
export interface PriceChange {
    previous:   number;
    current:    number;
    direction:  'up' | 'down';
    currency:   string;
    difference: number;
}

export interface HotelQuote {
    prebookId:            string;
    display?:             HotelDisplay;
    board?:               string;
    priceChange?:         PriceChange;
    roomSubstituted?:     boolean;
    substitutedRoomName?: string;
}

export type HotelCheckoutPhase =
    | 'idle'
    | 'quoting'
    | 'quoted'
    | 'price_changed'
    | 'unavailable'
    | 'supplier_down'
    | 'creating_payment'
    | 'awaiting_payment'
    | 'confirming'
    | 'pending'
    | 'needs_review'
    | 'confirmed'
    | 'failed';

export interface HotelCheckoutState {
    phase:            HotelCheckoutPhase;
    quote?:           HotelQuote;
    /** The total the traveller has agreed to, once they have accepted a changed price. */
    acceptedTotal?:   number;
    clientSecret?:    string;
    paymentIntentId?: string;
    /** The booking's reference, from the first answer that carried one. */
    reference?:       string;
    /** The last refusal, for the panel that explains it. */
    failure?:         CheckoutFailure;
    /** A message that is not a refusal: a card declined, a booking still being confirmed. */
    message?:         string;
    outcome?:         ConfirmOutcome;
}

export type HotelCheckoutEvent =
    | { type: 'QUOTE_REQUESTED' }
    | { type: 'QUOTE_RECEIVED'; quote: HotelQuote }
    | { type: 'QUOTE_FAILED'; failure: CheckoutFailure }
    | { type: 'PRICE_ACCEPTED' }
    | { type: 'PAYMENT_REQUESTED' }
    | { type: 'PAYMENT_READY'; clientSecret: string; paymentIntentId: string; chargedTotal?: number; serviceFee?: number }
    | { type: 'PAYMENT_FAILED'; failure: CheckoutFailure }
    | { type: 'CARD_FAILED'; message: string }
    | { type: 'PAYMENT_AUTHORISED' }
    | { type: 'CONFIRM_RESULT'; outcome: ConfirmOutcome }
    | { type: 'BACK_TO_DETAILS' }
    | { type: 'RESET' };

export const INITIAL_HOTEL_CHECKOUT: HotelCheckoutState = { phase: 'idle' };

const BUSY: ReadonlySet<HotelCheckoutPhase> = new Set(['quoting', 'creating_payment', 'confirming']);

/** True while a request is in flight and the form should not accept another action. */
export function isBusy(state: HotelCheckoutState): boolean {
    return BUSY.has(state.phase);
}

/** The details form may be submitted: there is a settled quote and nothing in flight. */
export function canSubmitDetails(state: HotelCheckoutState): boolean {
    return state.phase === 'quoted';
}

/** Phases a refusal at the quote step can leave the traveller in, by what kind it was. */
function phaseForFailure(failure: CheckoutFailure): HotelCheckoutPhase {
    switch (failure.kind) {
        case 'price_changed':        return 'price_changed';
        case 'unavailable':
        case 'not_payable_online':   return 'unavailable';
        case 'supplier_unavailable':
        case 'quote_expired':        return 'supplier_down';
        default:                     return 'failed';
    }
}

export function hotelCheckoutReducer(state: HotelCheckoutState, event: HotelCheckoutEvent): HotelCheckoutState {
    switch (event.type) {
        case 'QUOTE_REQUESTED': {
            const from: HotelCheckoutPhase[] = ['idle', 'quoted', 'price_changed', 'supplier_down'];
            if (!from.includes(state.phase)) return state;
            // The accepted total and the old quote ride along: the new quote is compared with them.
            return { ...state, phase: 'quoting', failure: undefined, message: undefined };
        }

        case 'QUOTE_RECEIVED': {
            if (state.phase !== 'quoting') return state;
            return {
                ...state,
                phase: event.quote.priceChange ? 'price_changed' : 'quoted',
                quote: event.quote,
                failure: undefined,
            };
        }

        case 'QUOTE_FAILED': {
            if (state.phase !== 'quoting') return state;
            return { ...state, phase: phaseForFailure(event.failure), failure: event.failure };
        }

        case 'PRICE_ACCEPTED': {
            if (state.phase !== 'price_changed' || !state.quote) return state;
            const accepted = state.quote.priceChange?.current
                ?? (state.failure?.kind === 'price_changed' ? state.failure.serverPrice : undefined)
                ?? state.quote.display?.total;
            return {
                ...state,
                phase: 'quoted',
                acceptedTotal: accepted,
                quote: { ...state.quote, priceChange: undefined },
                failure: undefined,
            };
        }

        case 'PAYMENT_REQUESTED': {
            if (state.phase !== 'quoted' || !state.quote) return state;
            return { ...state, phase: 'creating_payment', failure: undefined, message: undefined };
        }

        case 'PAYMENT_READY': {
            if (state.phase !== 'creating_payment') return state;
            const display = state.quote?.display;
            return {
                ...state,
                phase: 'awaiting_payment',
                clientSecret: event.clientSecret,
                paymentIntentId: event.paymentIntentId,
                quote: state.quote && display
                    ? {
                        ...state.quote,
                        display: {
                            ...display,
                            chargedTotal: event.chargedTotal ?? display.chargedTotal,
                            serviceFee:   event.serviceFee ?? display.serviceFee,
                        },
                    }
                    : state.quote,
            };
        }

        case 'PAYMENT_FAILED': {
            if (state.phase !== 'creating_payment') return state;
            const { failure } = event;
            switch (failure.kind) {
                case 'price_changed':      return { ...state, phase: 'price_changed', failure };
                case 'unavailable':
                case 'not_payable_online': return { ...state, phase: 'unavailable', failure };
                case 'duplicate':          return { ...state, phase: 'failed', failure };
                // Nothing about the booking is wrong: the form stays, with the reason.
                default:                   return { ...state, phase: 'quoted', failure };
            }
        }

        case 'CARD_FAILED': {
            if (state.phase !== 'awaiting_payment') return state;
            return { ...state, message: event.message };
        }

        case 'PAYMENT_AUTHORISED': {
            // Once. A second report of the same authorisation must not confirm a second time.
            if (state.phase !== 'awaiting_payment') return state;
            return { ...state, phase: 'confirming', message: undefined };
        }

        case 'CONFIRM_RESULT': {
            const from: HotelCheckoutPhase[] = ['confirming', 'pending', 'needs_review'];
            if (!from.includes(state.phase)) return state;
            const { outcome } = event;
            const reference = ('reference' in outcome ? outcome.reference : undefined) ?? state.reference;
            switch (outcome.kind) {
                case 'confirmed':    return { ...state, phase: 'confirmed', reference, outcome, message: undefined };
                case 'pending':      return { ...state, phase: 'pending', reference, outcome, message: outcome.message };
                case 'needs_review': return { ...state, phase: 'needs_review', reference, outcome, message: outcome.message };
                case 'failed':       return { ...state, phase: 'failed', reference, outcome, message: outcome.message };
            }
        }

        case 'BACK_TO_DETAILS': {
            const from: HotelCheckoutPhase[] = ['awaiting_payment', 'price_changed'];
            if (!from.includes(state.phase) || !state.quote) return state;
            return {
                ...state,
                phase: 'quoted',
                clientSecret: undefined,
                paymentIntentId: undefined,
                message: undefined,
            };
        }

        case 'RESET':
            return INITIAL_HOTEL_CHECKOUT;
    }
}
