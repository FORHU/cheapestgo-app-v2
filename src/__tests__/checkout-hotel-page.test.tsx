/**
 * The hotel checkout page, driven as a traveller would — against a stubbed API and a stubbed
 * Stripe, but through the real page, hook, machine, form and panels.
 *
 * The pieces each have their own tests. This is the one that notices when they are wired
 * together wrongly: a panel that never shows, a form that submits something the server cannot
 * read, a confirmed screen that invents a reference.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

// ── the world around the page ────────────────────────────────────────────────

let query = '';
const push = vi.fn();
const back = vi.fn();
const post = vi.fn();
const get = vi.fn();
const auth: { user: unknown; isLoading: boolean } = { user: { email: 'juan@example.com', first_name: '', last_name: '' }, isLoading: false };

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(query),
    useParams: () => ({}),
}));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
        <a href={href} {...rest}>{children}</a>
    ),
    useRouter: () => ({ push, back, replace: vi.fn() }),
}));
vi.mock('@/shared/lib/http', () => ({
    http: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) },
}));
vi.mock('@/shared/auth/store', () => ({ useAuthStore: () => auth }));
vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
vi.mock('@/shared/components/common/CurrencySelector', () => ({ CurrencySelector: () => null }));

// Stripe: a card form that is a single button, which "authorises" the card when pressed.
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(async () => ({})) }));
vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
    PaymentElement: () => <div data-testid="payment-element" />,
    useStripe: () => ({
        confirmPayment: vi.fn(async () => ({ paymentIntent: { id: 'pi_1', status: 'requires_capture' } })),
    }),
    useElements: () => ({}),
}));

import CheckoutPage from '@/app/[locale]/checkout/page';

// ── fixtures ─────────────────────────────────────────────────────────────────

const DISPLAY = { currency: 'USD', subtotal: 216, taxes: 24, total: 240, serviceFee: 14, chargedTotal: 254, converted: false };

const STAY_QUERY = {
    hotelId: 'MOCK-MNL-001', offerId: 'MOCK:offer', rateKey: 'MOCK:offer',
    roomName: 'Standard Double Room', hotelName: 'Bayside Grand Manila',
    checkIn: '2026-11-10', checkOut: '2026-11-12', adults: '2', children: '0',
    currency: 'USD', totalPrice: '238',
};

function visit(over: Record<string, string> = {}) {
    query = new URLSearchParams({ ...STAY_QUERY, ...over }).toString();
}

type Route = (body: Record<string, unknown>) => unknown;
function api(routes: Partial<Record<'prebook' | 'pay' | 'confirm' | 'status', Route>> = {}) {
    const r = {
        prebook: () => ({ success: true, data: { prebookId: 'MOCK:abc', display: DISPLAY, boardCode: 'BB' } }),
        pay:     () => ({ success: true, data: { clientSecret: 'cs_1', paymentIntentId: 'pi_1', bookingReference: 'CG-ABC123', chargedTotal: 254, serviceFee: 14 } }),
        confirm: () => ({ success: true, data: { bookingId: 'CG-ABC123', status: 'confirmed' } }),
        status:  () => ({ success: true, data: { reference: 'CG-ABC123', status: 'CONFIRMED', bookingStatus: 'confirmed', failure: null } }),
        ...routes,
    };
    post.mockImplementation(async (path: string, body: Record<string, unknown>) => {
        if (path.endsWith('/prebook')) return r.prebook(body);
        if (path.endsWith('/create-payment')) return r.pay(body);
        if (path.endsWith('/confirm')) return r.confirm(body);
        throw new Error(`unexpected POST ${path}`);
    });
    get.mockImplementation(async () => r.status({}));
}

const httpError = (status: number, body: Record<string, unknown>) =>
    Object.assign(new Error((body.message as string) ?? 'x'), { status, code: body.error, body });

const renderPage = () =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><CheckoutPage /></NextIntlClientProvider>);

const prebooks = () => post.mock.calls.filter((c) => String(c[0]).endsWith('/prebook')).map((c) => c[1] as Record<string, unknown>);
const payments = () => post.mock.calls.filter((c) => String(c[0]).endsWith('/create-payment')).map((c) => c[1] as Record<string, unknown>);

// Every guest's name fields carry the same example name, so the lead guest is the first pair
// on the form and the co-guest the second.
function fillHolder() {
    fireEvent.change(screen.getAllByPlaceholderText('John')[0], { target: { value: 'Juan' } });
    fireEvent.change(screen.getAllByPlaceholderText('Doe')[0], { target: { value: 'dela Cruz' } });
    fireEvent.change(screen.getByPlaceholderText('eg.johndoe@gmail.com'), { target: { value: 'juan@example.com' } });
}
function fillCoGuest() {
    fireEvent.change(screen.getAllByPlaceholderText('John')[1], { target: { value: 'Maria' } });
    fireEvent.change(screen.getAllByPlaceholderText('Doe')[1], { target: { value: 'dela Cruz' } });
}
const proceed = () => fireEvent.click(screen.getByRole('button', { name: /continue to payment/i }));

beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { email: 'juan@example.com', first_name: '', last_name: '' };
    visit();
    api();
});

// ── the tests ────────────────────────────────────────────────────────────────

describe('arriving', () => {
    it('asks the server for a quote and shows its total, not the URL\'s placeholder', async () => {
        renderPage();

        await waitFor(() => expect(prebooks()).toHaveLength(1));
        expect(prebooks()[0]).toMatchObject({ offerId: 'MOCK:offer', roomName: 'Standard Double Room', adults: 2, currency: 'USD' });
        // 254 is the server's charged total; the URL said 238.
        expect(await screen.findByText(/USD 254/)).toBeInTheDocument();
    });

    it('does not compare the quote with the placeholder total', async () => {
        renderPage();
        await waitFor(() => expect(prebooks()).toHaveLength(1));
        expect(prebooks()[0]).not.toHaveProperty('expectedTotal');
    });

    it('does compare it with a total the browser did not convert, when the property page sent one', async () => {
        visit({ expectedTotal: '240' });
        renderPage();
        await waitFor(() => expect(prebooks()).toHaveLength(1));
        expect(prebooks()[0]).toMatchObject({ expectedTotal: 240 });
    });

    it('says plainly that one room is being booked when several were searched', async () => {
        visit({ rooms: '2' });
        renderPage();
        expect(await screen.findByRole('note')).toHaveTextContent(/one room at a time/i);
    });

    it('is silent about rooms for a single-room search', async () => {
        renderPage();
        await screen.findByText(/USD 254/);
        expect(screen.queryByRole('note')).not.toBeInTheDocument();
    });
});

describe('a price that moved', () => {
    const moved = { previous: 240, current: 259.2, direction: 'up', currency: 'USD', difference: 19.2 };

    beforeEach(() => {
        visit({ expectedTotal: '240' });
        api({
            prebook: () => ({ success: true, data: {
                prebookId: 'MOCK:abc', priceChange: moved,
                display: { ...DISPLAY, total: 259.2, chargedTotal: 274 },
            } }),
        });
    });

    it('stops on the new price, and will not go on until it is accepted', async () => {
        renderPage();

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/price has changed/i);
        expect(within(alert).getByText(/\$259\.20/)).toBeInTheDocument();

        fillHolder(); fillCoGuest();
        expect(screen.getByRole('button', { name: /continue to payment/i })).toBeDisabled();
        expect(payments()).toHaveLength(0);
    });

    it('goes ahead once the traveller accepts', async () => {
        renderPage();
        fireEvent.click(await screen.findByRole('button', { name: /continue at the new price/i }));

        fillHolder(); fillCoGuest();
        await waitFor(() => expect(screen.getByRole('button', { name: /continue to payment/i })).toBeEnabled());
    });
});

describe('a room that has gone', () => {
    it('says so, and offers nothing that cannot work', async () => {
        api({ prebook: () => { throw httpError(409, { error: 'UNAVAILABLE', message: 'gone' }); } });
        renderPage();

        expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available/i);
        expect(screen.queryByPlaceholderText('John')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('treats an outage differently: nothing is wrong, try again', async () => {
        // The panel is no longer immediate. The supplier's silence is usually shorter than the
        // time spent on this form, so the quote is re-asked quietly first; only once those
        // attempts are spent is the traveller told, and given the way to try again themselves.
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            api({ prebook: () => { throw httpError(503, { error: 'UPSTREAM_UNAVAILABLE', message: 'down' }); } });
            renderPage();

            await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });

            expect(await screen.findByText(/nothing is wrong with your booking/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });

    it('leaves the details form usable while it is still re-asking', async () => {
        // The point of the quiet re-attempt: somebody mid-way through typing their name should
        // not have a red panel appear over a problem that clears itself in seconds.
        vi.useFakeTimers({ shouldAdvanceTime: true });
        try {
            api({ prebook: () => { throw httpError(503, { error: 'UPSTREAM_UNAVAILABLE', message: 'down' }); } });
            renderPage();

            await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });

            expect(screen.queryByText(/nothing is wrong with your booking/i)).not.toBeInTheDocument();
            expect(screen.getAllByPlaceholderText('John').length).toBeGreaterThan(0);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('the details form', () => {
    it('names what is missing, in words, and sends nothing', async () => {
        renderPage();
        await screen.findByText(/USD 254/);
        await waitFor(() => expect(screen.getByRole('button', { name: /continue to payment/i })).toBeEnabled());

        proceed();

        expect(await screen.findAllByText(/first name is required/i)).not.toHaveLength(0);
        expect(payments()).toHaveLength(0);
    });

    it('asks for each child\'s age', async () => {
        visit({ children: '1' });
        renderPage();
        await screen.findByText(/CHILD 1/);
        fillHolder(); fillCoGuest();
        await waitFor(() => expect(screen.getByRole('button', { name: /continue to payment/i })).toBeEnabled());

        proceed();

        expect(await screen.findByText(/enter an age from 0 to 17/i)).toBeInTheDocument();
        expect(payments()).toHaveLength(0);
    });

    it('shows every guest\'s name fields with the same example name', async () => {
        // One example person across the booking forms — the lead guest and every other
        // guest alike, rather than a second, different made-up name for the co-guest.
        visit({ adults: '2' });
        renderPage();
        await screen.findByText(/USD 254/);

        expect(screen.getAllByPlaceholderText('John')).toHaveLength(2);
        expect(screen.getAllByPlaceholderText('Doe')).toHaveLength(2);
    });
});

describe('paying and confirming', () => {
    async function toPayment(over: Record<string, string> = {}) {
        if (Object.keys(over).length) visit(over);
        renderPage();
        await screen.findByText(/USD 254/);
        await waitFor(() => expect(screen.getByRole('button', { name: /continue to payment/i })).toBeEnabled());
        fillHolder(); fillCoGuest();
    }

    it('opens a payment carrying everything the server needs to finish the booking itself', async () => {
        await toPayment({ children: '1' });
        fireEvent.change(screen.getByPlaceholderText('0–17'), { target: { value: '0' } });
        fireEvent.change(screen.getByPlaceholderText(/the property will do its best/i), { target: { value: 'High floor' } });
        fireEvent.change(document.querySelector('input[type="tel"]') as HTMLInputElement, { target: { value: '917 123 4567' } });

        proceed();

        await waitFor(() => expect(payments()).toHaveLength(1));
        expect(payments()[0]).toMatchObject({
            prebookId: 'MOCK:abc', amount: 240, currency: 'USD', displayedTotal: 254,
            holder: { firstName: 'Juan', lastName: 'dela Cruz', email: 'juan@example.com' },
            holderPhone: '+63 917 123 4567',
            specialRequests: 'High floor',
            adults: 2, children: 1, board: 'BB',
        });
        // The holder, the other adult, then the infant — with its age of zero kept.
        const guests = payments()[0].guests as Array<{ firstName: string; age?: number }>;
        expect(guests.map((g) => g.firstName)).toEqual(['Juan', 'Maria', '']);
        expect(guests[2].age).toBe(0);

        expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    });

    it('shows the booking\'s own reference once confirmed — never one it made up', async () => {
        await toPayment();
        proceed();
        fireEvent.click(await screen.findByRole('button', { name: /pay usd/i }));

        expect(await screen.findByText('CG-ABC123')).toBeInTheDocument();
        const confirm = post.mock.calls.find((c) => String(c[0]).endsWith('/confirm'));
        expect(confirm?.[1]).toMatchObject({ paymentIntentId: 'pi_1', prebookId: 'MOCK:abc' });
        // No number was typed, so none is sent — not a bare dial code.
        expect(confirm?.[1]).not.toHaveProperty('holderPhone');
    });

    it('does not show a confirmed booking when the supplier refused it', async () => {
        api({ confirm: () => ({ success: false, providerConfirmed: false, error: 'Room is gone' }) });
        await toPayment();
        proceed();
        fireEvent.click(await screen.findByRole('button', { name: /pay usd/i }));

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent(/couldn't complete your booking/i);
        expect(screen.getByText(/have not been charged/i)).toBeInTheDocument();
        expect(screen.queryByText(/booked/i)).not.toBeInTheDocument();
    });

    it('lets the traveller pay again after a failed booking, instead of a permanent spinner', async () => {
        api({ confirm: () => ({ success: false, providerConfirmed: false, error: 'Room is gone' }) });
        await toPayment();
        proceed();
        fireEvent.click(await screen.findByRole('button', { name: /pay usd/i }));

        fireEvent.click(await screen.findByRole('button', { name: /try again/i }));

        await waitFor(() => expect(screen.getByRole('button', { name: /continue to payment/i })).toBeEnabled());
    });

    it('says the booking is being confirmed, not failed, when the outcome is unknown', async () => {
        api({ confirm: () => ({ success: false, needsReview: true, reference: 'CG-ABC123', error: 'unknown' }) });
        await toPayment();
        proceed();
        fireEvent.click(await screen.findByRole('button', { name: /pay usd/i }));

        expect(await screen.findByRole('status')).toHaveTextContent(/confirming this with the hotel/i);
        expect(screen.getByText(/won't be charged twice/i)).toBeInTheDocument();
        expect(screen.getByText('CG-ABC123')).toBeInTheDocument();
    });

    it('sends the traveller back to sign in when they are not', async () => {
        auth.user = null;
        await toPayment();
        proceed();

        await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/login\?redirect=/)));
        expect(payments()).toHaveLength(0);
    });
});

describe('the form, in the brand\'s look', () => {
    const ringed = (el: Element | null) => el?.getAttribute('style') ?? '';

    it('rings every field in the brand gradient before anything is typed', async () => {
        visit({ adults: '2', children: '1' });
        renderPage();

        // blue-600 → cyan-500, as jsdom writes them back.
        const gradientRing = /linear-gradient\(90deg, rgb\(37, 99, 235\) 0%, rgb\(6, 182, 212\) 100%\) border-box/;
        for (const placeholder of ['John', 'Doe', 'eg.johndoe@gmail.com']) {
            for (const field of await screen.findAllByPlaceholderText(placeholder)) {
                expect(ringed(field)).toMatch(gradientRing);
            }
        }
        expect(ringed(document.querySelector('.cg-phone'))).toMatch(gradientRing);
        expect(ringed(document.querySelector('textarea'))).toMatch(gradientRing);
    });

    it('trades the ring for a red edge on a field that is wrong', async () => {
        renderPage();
        await screen.findAllByPlaceholderText('John');
        proceed();

        // The lead guest's first name — the first of the form's name fields.
        const [first] = await screen.findAllByPlaceholderText('John');
        await waitFor(() => expect(ringed(first)).not.toMatch(/linear-gradient/));
        expect(first).toHaveStyle({ borderColor: '#E4685A' });
    });

    it('fills the main action with the brand gradient', async () => {
        renderPage();
        expect(ringed(await screen.findByRole('button', { name: /continue to payment/i }))).toMatch(/linear-gradient/);
    });
});
