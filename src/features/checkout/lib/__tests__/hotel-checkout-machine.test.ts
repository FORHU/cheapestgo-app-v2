import { describe, it, expect } from 'vitest';
import {
    INITIAL_HOTEL_CHECKOUT,
    hotelCheckoutReducer,
    canSubmitDetails,
    isBusy,
    type HotelCheckoutState,
    type HotelCheckoutEvent,
    type HotelQuote,
} from '../hotel-checkout-machine';

const QUOTE: HotelQuote = {
    prebookId: 'TGX:abc',
    display: { currency: 'USD', subtotal: 216, taxes: 24, total: 240, serviceFee: 14, chargedTotal: 254, converted: false },
    board: 'BB',
};

function run(...events: HotelCheckoutEvent[]): HotelCheckoutState {
    return events.reduce(hotelCheckoutReducer, INITIAL_HOTEL_CHECKOUT);
}

const quoted = () => run({ type: 'QUOTE_REQUESTED' }, { type: 'QUOTE_RECEIVED', quote: QUOTE });

describe('quoting', () => {
    it('starts idle and not busy', () => {
        expect(INITIAL_HOTEL_CHECKOUT.phase).toBe('idle');
        expect(isBusy(INITIAL_HOTEL_CHECKOUT)).toBe(false);
    });

    it('moves from asking, to a quote the form can proceed on', () => {
        expect(run({ type: 'QUOTE_REQUESTED' }).phase).toBe('quoting');
        const s = quoted();
        expect(s.phase).toBe('quoted');
        expect(s.quote).toEqual(QUOTE);
        expect(canSubmitDetails(s)).toBe(true);
    });

    it('stops at a price that moved, rather than letting the form carry on at the new one', () => {
        const s = run(
            { type: 'QUOTE_REQUESTED' },
            { type: 'QUOTE_RECEIVED', quote: { ...QUOTE, priceChange: { previous: 240, current: 259.2, direction: 'up', currency: 'USD', difference: 19.2 } } },
        );
        expect(s.phase).toBe('price_changed');
        expect(canSubmitDetails(s)).toBe(false);
    });

    it('goes ahead once the new price is accepted', () => {
        const moved: HotelQuote = { ...QUOTE, priceChange: { previous: 240, current: 259.2, direction: 'up', currency: 'USD', difference: 19.2 } };
        const s = run(
            { type: 'QUOTE_REQUESTED' }, { type: 'QUOTE_RECEIVED', quote: moved }, { type: 'PRICE_ACCEPTED' },
        );
        expect(s.phase).toBe('quoted');
        // The accepted figure becomes the one later quotes are compared against.
        expect(s.acceptedTotal).toBe(259.2);
        expect(s.quote?.priceChange).toBeUndefined();
    });

    it('sends a sold-out room somewhere it cannot be retried from', () => {
        const s = run({ type: 'QUOTE_REQUESTED' }, { type: 'QUOTE_FAILED', failure: { kind: 'unavailable', message: 'gone' } });
        expect(s.phase).toBe('unavailable');
        expect(canSubmitDetails(s)).toBe(false);
    });

    it('treats a supplier outage as retryable', () => {
        const s = run(
            { type: 'QUOTE_REQUESTED' },
            { type: 'QUOTE_FAILED', failure: { kind: 'supplier_unavailable', message: 'down', retryable: true } },
        );
        expect(s.phase).toBe('supplier_down');
        // And asking again is allowed from there.
        expect(hotelCheckoutReducer(s, { type: 'QUOTE_REQUESTED' }).phase).toBe('quoting');
    });

    it('shows a price change reported as an error with the figure it came with', () => {
        const s = run(
            { type: 'QUOTE_REQUESTED' },
            { type: 'QUOTE_FAILED', failure: { kind: 'price_changed', message: 'moved', serverPrice: 259.2, currency: 'USD' } },
        );
        expect(s.phase).toBe('price_changed');
        expect(s.failure).toMatchObject({ kind: 'price_changed', serverPrice: 259.2 });
    });
});

describe('paying', () => {
    it('opens a payment from a quote, and shows the card form when it is ready', () => {
        const s = hotelCheckoutReducer(quoted(), { type: 'PAYMENT_REQUESTED' });
        expect(s.phase).toBe('creating_payment');
        expect(isBusy(s)).toBe(true);

        const ready = hotelCheckoutReducer(s, { type: 'PAYMENT_READY', clientSecret: 'cs_1', paymentIntentId: 'pi_1', chargedTotal: 254.5 });
        expect(ready.phase).toBe('awaiting_payment');
        expect(ready.clientSecret).toBe('cs_1');
        expect(ready.paymentIntentId).toBe('pi_1');
        expect(ready.quote?.display?.chargedTotal).toBe(254.5);
    });

    it('cannot open a second payment while one is being opened', () => {
        const s = hotelCheckoutReducer(quoted(), { type: 'PAYMENT_REQUESTED' });
        expect(hotelCheckoutReducer(s, { type: 'PAYMENT_REQUESTED' })).toBe(s);
    });

    it('cannot pay without a quote', () => {
        expect(hotelCheckoutReducer(INITIAL_HOTEL_CHECKOUT, { type: 'PAYMENT_REQUESTED' })).toBe(INITIAL_HOTEL_CHECKOUT);
    });

    it('returns to the price panel when the server refuses the charge at a new price', () => {
        const s = run(
            { type: 'QUOTE_REQUESTED' }, { type: 'QUOTE_RECEIVED', quote: QUOTE }, { type: 'PAYMENT_REQUESTED' },
            { type: 'PAYMENT_FAILED', failure: { kind: 'price_changed', message: 'moved', serverPrice: 270, currency: 'USD' } },
        );
        expect(s.phase).toBe('price_changed');
        expect(s.failure).toMatchObject({ serverPrice: 270 });
    });

    it('keeps the form open, with a message, when something the traveller can fix went wrong', () => {
        const s = run(
            { type: 'QUOTE_REQUESTED' }, { type: 'QUOTE_RECEIVED', quote: QUOTE }, { type: 'PAYMENT_REQUESTED' },
            { type: 'PAYMENT_FAILED', failure: { kind: 'validation', message: 'Invalid', fields: { holder: 'Required' } } },
        );
        expect(s.phase).toBe('quoted');
        expect(s.failure).toMatchObject({ kind: 'validation' });
    });

    it('lets a card be retried without leaving the payment step', () => {
        const awaiting = run(
            { type: 'QUOTE_REQUESTED' }, { type: 'QUOTE_RECEIVED', quote: QUOTE }, { type: 'PAYMENT_REQUESTED' },
            { type: 'PAYMENT_READY', clientSecret: 'cs_1', paymentIntentId: 'pi_1' },
        );
        const declined = hotelCheckoutReducer(awaiting, { type: 'CARD_FAILED', message: 'Your card was declined.' });
        expect(declined.phase).toBe('awaiting_payment');
        expect(declined.message).toBe('Your card was declined.');
        expect(declined.clientSecret).toBe('cs_1');
    });

    it('clears the intent when the traveller steps back to the form', () => {
        const awaiting = run(
            { type: 'QUOTE_REQUESTED' }, { type: 'QUOTE_RECEIVED', quote: QUOTE }, { type: 'PAYMENT_REQUESTED' },
            { type: 'PAYMENT_READY', clientSecret: 'cs_1', paymentIntentId: 'pi_1' },
        );
        const back = hotelCheckoutReducer(awaiting, { type: 'BACK_TO_DETAILS' });
        expect(back.phase).toBe('quoted');
        expect(back.clientSecret).toBeUndefined();
        expect(back.paymentIntentId).toBeUndefined();
    });
});

describe('confirming', () => {
    const awaiting = () => run(
        { type: 'QUOTE_REQUESTED' }, { type: 'QUOTE_RECEIVED', quote: QUOTE }, { type: 'PAYMENT_REQUESTED' },
        { type: 'PAYMENT_READY', clientSecret: 'cs_1', paymentIntentId: 'pi_1' },
    );

    it('confirms once, however many times the authorisation is reported', () => {
        const confirming = hotelCheckoutReducer(awaiting(), { type: 'PAYMENT_AUTHORISED' });
        expect(confirming.phase).toBe('confirming');
        expect(hotelCheckoutReducer(confirming, { type: 'PAYMENT_AUTHORISED' })).toBe(confirming);
    });

    it('cannot be authorised before there is a payment to authorise', () => {
        const s = quoted();
        expect(hotelCheckoutReducer(s, { type: 'PAYMENT_AUTHORISED' })).toBe(s);
    });

    it.each([
        [{ kind: 'confirmed', reference: 'CG-ABC123', status: 'confirmed' }, 'confirmed'],
        [{ kind: 'pending', reference: 'CG-ABC123', message: 'm' }, 'pending'],
        [{ kind: 'needs_review', reference: 'CG-ABC123', message: 'm' }, 'needs_review'],
        [{ kind: 'failed', message: 'm', released: true }, 'failed'],
    ] as const)('lands in the phase that matches the outcome (%o)', (outcome, phase) => {
        const s = hotelCheckoutReducer(
            hotelCheckoutReducer(awaiting(), { type: 'PAYMENT_AUTHORISED' }),
            { type: 'CONFIRM_RESULT', outcome },
        );
        expect(s.phase).toBe(phase);
    });

    it('keeps the reference, so a refresh or a poll has something to ask about', () => {
        const s = hotelCheckoutReducer(
            hotelCheckoutReducer(awaiting(), { type: 'PAYMENT_AUTHORISED' }),
            { type: 'CONFIRM_RESULT', outcome: { kind: 'pending', reference: 'CG-ABC123', message: 'm' } },
        );
        expect(s.reference).toBe('CG-ABC123');
    });

    it('settles a pending booking from a later poll', () => {
        const pending = hotelCheckoutReducer(
            hotelCheckoutReducer(awaiting(), { type: 'PAYMENT_AUTHORISED' }),
            { type: 'CONFIRM_RESULT', outcome: { kind: 'pending', reference: 'CG-ABC123', message: 'm' } },
        );
        const done = hotelCheckoutReducer(pending, {
            type: 'CONFIRM_RESULT', outcome: { kind: 'confirmed', reference: 'CG-ABC123', status: 'confirmed' },
        });
        expect(done.phase).toBe('confirmed');
    });

    it('does not take a late result into a finished booking', () => {
        const done = hotelCheckoutReducer(
            hotelCheckoutReducer(awaiting(), { type: 'PAYMENT_AUTHORISED' }),
            { type: 'CONFIRM_RESULT', outcome: { kind: 'confirmed', reference: 'CG-ABC123', status: 'confirmed' } },
        );
        const after = hotelCheckoutReducer(done, {
            type: 'CONFIRM_RESULT', outcome: { kind: 'failed', message: 'stale', released: false },
        });
        expect(after.phase).toBe('confirmed');
    });
});

describe('reset', () => {
    it('forgets everything', () => {
        expect(hotelCheckoutReducer(quoted(), { type: 'RESET' })).toEqual(INITIAL_HOTEL_CHECKOUT);
    });
});
