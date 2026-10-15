import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHotelCheckout, type UseHotelCheckoutOptions } from '../use-hotel-checkout';
import type { CheckoutHttp } from '../../lib/hotel-checkout-api';
import type { HotelGuestPayload } from '../../lib/hotel-guest-form';

const DISPLAY = { currency: 'USD', subtotal: 216, taxes: 24, total: 240, serviceFee: 14, chargedTotal: 254, converted: false };

const STAY = {
    hotelName: 'Bayside Grand Manila', roomName: 'Standard Double Room', hotelImage: '',
    checkIn: '2026-11-10', checkOut: '2026-11-12', adults: 2, children: 0, currency: 'USD',
};

const GUEST: HotelGuestPayload = {
    holder: { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' },
    guests: [{ firstName: 'Juan', lastName: 'dela Cruz' }, { firstName: 'Maria', lastName: 'dela Cruz' }],
};

const httpError = (status: number, body: Record<string, unknown>) =>
    Object.assign(new Error((body.message as string) ?? 'x'), { status, code: body.error, body });

type FakeClient = CheckoutHttp & {
    post: ReturnType<typeof vi.fn>;
    get:  ReturnType<typeof vi.fn>;
};

/** A client whose routes can each be replaced per test. */
function fakeClient(routes: Partial<Record<'prebook' | 'pay' | 'confirm' | 'status', (body: any) => unknown>> = {}): FakeClient {
    const defaults = {
        prebook: () => ({ success: true, data: { prebookId: 'MOCK:abc', display: DISPLAY, boardCode: 'BB' } }),
        pay:     () => ({ success: true, data: { clientSecret: 'cs_1', paymentIntentId: 'pi_1', bookingReference: 'CG-ABC123', chargedTotal: 254, serviceFee: 14 } }),
        confirm: () => ({ success: true, data: { bookingId: 'CG-ABC123', status: 'confirmed' } }),
        status:  () => ({ success: true, data: { reference: 'CG-ABC123', status: 'CONFIRMED', bookingStatus: 'confirmed', failure: null } }),
    };
    const r = { ...defaults, ...routes };
    return {
        post: vi.fn(async (path: string, body: unknown) => {
            if (path.endsWith('/prebook')) return r.prebook(body);
            if (path.endsWith('/create-payment')) return r.pay(body);
            if (path.endsWith('/confirm')) return r.confirm(body);
            throw new Error(`unexpected POST ${path}`);
        }),
        get: vi.fn(async () => r.status({})),
    } as FakeClient;
}

function setup(client: FakeClient, over: Partial<UseHotelCheckoutOptions> = {}) {
    return renderHook((props: Partial<UseHotelCheckoutOptions>) => useHotelCheckout({
        enabled: true, rateKey: 'MOCK:offer', stay: STAY, placeholderTotal: 238, client, pollMs: 10, maxPolls: 3,
        ...over, ...props,
    }), { initialProps: {} });
}

const prebookBodies = (c: FakeClient) => c.post.mock.calls.filter((x) => String(x[0]).endsWith('/prebook')).map((x) => x[1]);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe('arriving', () => {
    it('asks for a quote and settles on it', async () => {
        const c = fakeClient();
        const { result } = setup(c);

        await waitFor(() => expect(result.current.state.phase).toBe('quoted'));

        expect(result.current.state.quote?.display?.total).toBe(240);
        expect(result.current.state.quote?.board).toBe('BB');
        expect(result.current.canSubmit).toBe(true);
        expect(prebookBodies(c)).toHaveLength(1);
    });

    it('does nothing until it is enabled', async () => {
        const c = fakeClient();
        const { result } = setup(c, { enabled: false });
        await act(async () => { await Promise.resolve(); });
        expect(result.current.state.phase).toBe('idle');
        expect(c.post).not.toHaveBeenCalled();
    });

    it('sends no expected total unless it was given one', async () => {
        const c = fakeClient();
        setup(c);
        await waitFor(() => expect(prebookBodies(c)).toHaveLength(1));
        expect(prebookBodies(c)[0]).not.toHaveProperty('expectedTotal');
    });

    it('sends the one it was given, once, on the first request', async () => {
        const c = fakeClient();
        setup(c, { initialExpectedTotal: 240 });
        await waitFor(() => expect(prebookBodies(c)).toHaveLength(1));
        expect(prebookBodies(c)[0]).toMatchObject({ expectedTotal: 240 });
    });

    it('treats a sold-out room as a place to be, not an error to retry', async () => {
        const c = fakeClient({ prebook: () => { throw httpError(409, { error: 'UNAVAILABLE', message: 'gone' }); } });
        const { result } = setup(c);

        await waitFor(() => expect(result.current.state.phase).toBe('unavailable'));

        expect(result.current.canSubmit).toBe(false);
        expect(prebookBodies(c)).toHaveLength(1);
    });

    it('lets a supplier outage be tried again', async () => {
        let calls = 0;
        const c = fakeClient({
            prebook: () => {
                calls += 1;
                if (calls === 1) throw httpError(503, { error: 'UPSTREAM_UNAVAILABLE', message: 'down' });
                return { success: true, data: { prebookId: 'MOCK:abc', display: DISPLAY } };
            },
        });
        const { result } = setup(c);
        await waitFor(() => expect(result.current.state.phase).toBe('supplier_down'));

        await act(async () => { await result.current.refreshQuote(); });

        expect(result.current.state.phase).toBe('quoted');
    });
});

describe('a price that moved', () => {
    const moved = { previous: 240, current: 259.2, direction: 'up', currency: 'USD', difference: 19.2 };

    it('stops on the new price, and goes ahead once it is accepted', async () => {
        const c = fakeClient({
            prebook: () => ({ success: true, data: {
                prebookId: 'MOCK:abc', display: { ...DISPLAY, total: 259.2, chargedTotal: 274 }, priceChange: moved,
            } }),
        });
        const { result } = setup(c, { initialExpectedTotal: 240 });
        await waitFor(() => expect(result.current.state.phase).toBe('price_changed'));
        expect(result.current.canSubmit).toBe(false);

        act(() => result.current.acceptPrice());

        expect(result.current.state.phase).toBe('quoted');
        expect(result.current.state.acceptedTotal).toBe(259.2);
    });

    it('compares the next quote with what the server showed, not with the page\'s placeholder', async () => {
        const c = fakeClient();
        const { result } = setup(c, { initialExpectedTotal: 999 });
        await waitFor(() => expect(result.current.state.phase).toBe('quoted'));

        await act(async () => { await result.current.refreshQuote(); });

        const bodies = prebookBodies(c);
        expect(bodies[0]).toMatchObject({ expectedTotal: 999 });
        expect(bodies[1]).toMatchObject({ expectedTotal: 240 });
    });

    it('does not compare across currencies', async () => {
        const c = fakeClient();
        const { result, rerender } = setup(c);
        await waitFor(() => expect(result.current.state.phase).toBe('quoted'));

        rerender({ stay: { ...STAY, currency: 'PHP' } });
        await waitFor(() => expect(prebookBodies(c)).toHaveLength(2));

        expect(prebookBodies(c)[1]).toMatchObject({ currency: 'PHP' });
        expect(prebookBodies(c)[1]).not.toHaveProperty('expectedTotal');
    });

    it('ignores a response that has been overtaken', async () => {
        const releases: Array<() => void> = [];
        const c = fakeClient({
            prebook: (body: { currency: string }) => new Promise((resolve) => {
                releases.push(() => resolve({ success: true, data: {
                    prebookId: `MOCK:${body.currency}`, display: { ...DISPLAY, currency: body.currency },
                } }));
            }),
        });
        const { result, rerender } = setup(c);
        await waitFor(() => expect(releases).toHaveLength(1));

        rerender({ stay: { ...STAY, currency: 'PHP' } });
        await waitFor(() => expect(releases).toHaveLength(2));

        // The newer answer lands first; the older one lands afterwards and must not win.
        await act(async () => { releases[1](); await Promise.resolve(); });
        await act(async () => { releases[0](); await Promise.resolve(); });

        expect(result.current.state.quote?.prebookId).toBe('MOCK:PHP');
    });
});

describe('paying', () => {
    async function quoted(c: FakeClient) {
        const hook = setup(c);
        await waitFor(() => expect(hook.result.current.state.phase).toBe('quoted'));
        return hook;
    }

    it('opens the payment from the server\'s figures and keeps the reference', async () => {
        const c = fakeClient();
        const { result } = await quoted(c);

        await act(async () => { await result.current.submitDetails(GUEST); });

        expect(result.current.state.phase).toBe('awaiting_payment');
        expect(result.current.state.clientSecret).toBe('cs_1');
        expect(result.current.state.reference).toBe('CG-ABC123');
        const body = c.post.mock.calls.find((x) => String(x[0]).endsWith('/create-payment'))![1];
        expect(body).toMatchObject({ amount: 240, displayedTotal: 254, holder: GUEST.holder, adults: 2 });
    });

    it('opens one payment, however many times submit is pressed', async () => {
        const c = fakeClient();
        const { result } = await quoted(c);

        await act(async () => {
            await Promise.all([result.current.submitDetails(GUEST), result.current.submitDetails(GUEST)]);
        });

        const payments = c.post.mock.calls.filter((x) => String(x[0]).endsWith('/create-payment'));
        expect(payments).toHaveLength(1);
    });

    it('takes the quote again when the server says the price has moved', async () => {
        let pays = 0;
        const c = fakeClient({
            pay: () => {
                pays += 1;
                throw httpError(409, { error: 'PRICE_CHANGED', message: 'moved', serverPrice: 259.2, currency: 'USD' });
            },
        });
        const { result } = await quoted(c);

        await act(async () => { await result.current.submitDetails(GUEST); });

        await waitFor(() => expect(prebookBodies(c)).toHaveLength(2));
        expect(pays).toBe(1);
        // The re-quote carries what the traveller was shown, so the server can say by how much.
        expect(prebookBodies(c)[1]).toMatchObject({ expectedTotal: 240 });
    });

    it('keeps the form, with the reason, when the supplier is down', async () => {
        const c = fakeClient({ pay: () => { throw httpError(503, { error: 'UPSTREAM_UNAVAILABLE', message: 'down' }); } });
        const { result } = await quoted(c);

        await act(async () => { await result.current.submitDetails(GUEST); });

        expect(result.current.state.phase).toBe('quoted');
        expect(result.current.state.failure).toMatchObject({ kind: 'supplier_unavailable' });
    });

    it('lets a declined card be retried on the same payment', async () => {
        const c = fakeClient();
        const { result } = await quoted(c);
        await act(async () => { await result.current.submitDetails(GUEST); });

        act(() => result.current.onCardError('Your card was declined.'));

        expect(result.current.state.phase).toBe('awaiting_payment');
        expect(result.current.state.message).toBe('Your card was declined.');
    });
});

describe('confirming', () => {
    async function awaitingPayment(c: FakeClient) {
        const hook = setup(c);
        await waitFor(() => expect(hook.result.current.state.phase).toBe('quoted'));
        await act(async () => { await hook.result.current.submitDetails(GUEST); });
        return hook;
    }

    const confirms = (c: FakeClient) => c.post.mock.calls.filter((x) => String(x[0]).endsWith('/confirm'));

    it('confirms and lands on the booking', async () => {
        const c = fakeClient();
        const { result } = await awaitingPayment(c);

        await act(async () => { await result.current.onCardAuthorised('pi_1'); });

        expect(result.current.state.phase).toBe('confirmed');
        expect(result.current.state.reference).toBe('CG-ABC123');
    });

    it('confirms once however many times the card is reported authorised', async () => {
        const c = fakeClient();
        const { result } = await awaitingPayment(c);

        await act(async () => {
            await Promise.all([result.current.onCardAuthorised('pi_1'), result.current.onCardAuthorised('pi_1')]);
        });

        expect(confirms(c)).toHaveLength(1);
    });

    it('does not retry a confirm whose answer was lost — it asks what became of the booking', async () => {
        const c = fakeClient({
            confirm: () => { throw new TypeError('Failed to fetch'); },
            status:  () => ({ success: true, data: { reference: 'CG-ABC123', status: 'CONFIRMED', bookingStatus: 'confirmed', failure: null } }),
        });
        const { result } = await awaitingPayment(c);

        await act(async () => { await result.current.onCardAuthorised('pi_1'); });
        expect(result.current.state.phase).toBe('pending');

        await waitFor(() => expect(result.current.state.phase).toBe('confirmed'));
        expect(confirms(c)).toHaveLength(1);
        expect(c.get).toHaveBeenCalledWith('/hotels/bookings/CG-ABC123');
    });

    it('keeps asking while the booking is still being made', async () => {
        let asked = 0;
        const c = fakeClient({
            confirm: () => ({ success: false, pending: true, reference: 'CG-ABC123', error: 'in progress' }),
            status: () => {
                asked += 1;
                return { success: true, data: {
                    reference: 'CG-ABC123', status: asked < 2 ? 'SUPPLIER_BOOKING' : 'CONFIRMED', bookingStatus: null, failure: null,
                } };
            },
        });
        const { result } = await awaitingPayment(c);

        await act(async () => { await result.current.onCardAuthorised('pi_1'); });

        await waitFor(() => expect(result.current.state.phase).toBe('confirmed'));
        expect(asked).toBeGreaterThanOrEqual(2);
    });

    it('stops asking and says so when the booking will not settle', async () => {
        const c = fakeClient({
            confirm: () => ({ success: false, pending: true, reference: 'CG-ABC123', error: 'in progress' }),
            status:  () => ({ success: true, data: { reference: 'CG-ABC123', status: 'SUPPLIER_BOOKING', bookingStatus: null, failure: null } }),
        });
        const { result } = await awaitingPayment(c);

        await act(async () => { await result.current.onCardAuthorised('pi_1'); });

        await waitFor(() => expect(result.current.state.phase).toBe('needs_review'));
        expect(c.get).toHaveBeenCalledTimes(3);
    });

    it('settles an unknown outcome to the server\'s eventual answer', async () => {
        let asked = 0;
        const c = fakeClient({
            confirm: () => ({ success: false, needsReview: true, reference: 'CG-ABC123', error: 'unknown' }),
            status:  () => {
                asked += 1;
                return { success: true, data: {
                    reference: 'CG-ABC123', status: asked < 2 ? 'NEEDS_REVIEW' : 'CONFIRMED', bookingStatus: 'confirmed', failure: null,
                } };
            },
        });
        const { result } = await awaitingPayment(c);

        await act(async () => { await result.current.onCardAuthorised('pi_1'); });
        expect(result.current.state.phase).toBe('needs_review');

        await waitFor(() => expect(result.current.state.phase).toBe('confirmed'));
    });

    it('treats a payment that was not authorised as a failure, not as something to wait on', async () => {
        const c = fakeClient({ confirm: () => { throw httpError(402, { error: 'PAYMENT_REQUIRED', message: 'not authorised' }); } });
        const { result } = await awaitingPayment(c);

        await act(async () => { await result.current.onCardAuthorised('pi_1'); });

        expect(result.current.state.phase).toBe('failed');
        expect(c.get).not.toHaveBeenCalled();
    });

    it('reports a definitive refusal, and that the hold was released', async () => {
        const c = fakeClient({ confirm: () => ({ success: false, providerConfirmed: false, error: 'Room is gone' }) });
        const { result } = await awaitingPayment(c);

        await act(async () => { await result.current.onCardAuthorised('pi_1'); });

        expect(result.current.state).toMatchObject({
            phase: 'failed', outcome: { kind: 'failed', released: true, message: 'Room is gone' },
        });
    });
});

describe('when the quote itself is refused as a price change', () => {
    it('takes it once more, so there is a figure to show', async () => {
        let calls = 0;
        const c = fakeClient({
            prebook: () => {
                calls += 1;
                if (calls === 1) throw httpError(409, { error: 'PRICE_CHANGED', message: 'moved', serverPrice: 259.2, currency: 'USD' });
                return { success: true, data: { prebookId: 'MOCK:abc', display: { ...DISPLAY, total: 259.2 } } };
            },
        });
        const { result } = setup(c);

        await waitFor(() => expect(result.current.state.phase).toBe('quoted'));
        expect(calls).toBe(2);
    });

    it('does not loop when the second answer is the same refusal', async () => {
        const c = fakeClient({
            prebook: () => { throw httpError(409, { error: 'PRICE_CHANGED', message: 'moved', serverPrice: 259.2, currency: 'USD' }); },
        });
        const { result } = setup(c);

        await waitFor(() => expect(result.current.state.phase).toBe('price_changed'));
        await act(async () => { await new Promise((r) => setTimeout(r, 40)); });

        expect(prebookBodies(c)).toHaveLength(2);
    });
});

describe('restart', () => {
    it('starts again from a failed booking with a fresh quote', async () => {
        const c = fakeClient({ confirm: () => ({ success: false, providerConfirmed: false, error: 'Room is gone' }) });
        const { result } = setup(c);
        await waitFor(() => expect(result.current.state.phase).toBe('quoted'));
        await act(async () => { await result.current.submitDetails(GUEST); });
        await act(async () => { await result.current.onCardAuthorised('pi_1'); });
        expect(result.current.state.phase).toBe('failed');

        await act(async () => { result.current.restart(); });

        await waitFor(() => expect(result.current.state.phase).toBe('quoted'));
        expect(result.current.state.reference).toBeUndefined();
        expect(prebookBodies(c)).toHaveLength(2);
    });
});
