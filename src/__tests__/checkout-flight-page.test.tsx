/**
 * The flight checkout page after the card: driven as a traveller would, against a stubbed API
 * and a stubbed Stripe.
 *
 * The card is authorised before the airline is asked (the API's flight booking lifecycle), so
 * `/flights/confirm` can now answer three new ways: the airline has not settled it yet, the fare
 * rose, or it sold out — the last two with the hold already released. Each has to reach the
 * traveller as what it is, not as the same red sentence.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

// ── the world around the page ────────────────────────────────────────────────

let query = '';
const push = vi.fn();
const back = vi.fn();
const post = vi.fn();
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
    http: { post: (...a: unknown[]) => post(...a), get: vi.fn() },
}));
vi.mock('@/shared/auth/store', () => ({ useAuthStore: () => auth }));
vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
vi.mock('@/shared/components/common/CurrencySelector', () => ({ CurrencySelector: () => null }));

// Stripe: a card form whose pay button authorises — manual capture, so `requires_capture`.
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

const FLIGHT_QUERY = {
    offerId: 'off_1', origin: 'MNL', destination: 'NRT', departureDate: '2026-12-01',
    currency: 'USD', totalAmount: '250', adults: '1',
};

const httpError = (status: number, body: Record<string, unknown>) =>
    Object.assign(new Error((body.message as string) ?? 'x'), { status, code: body.error, body });

type Confirm = () => unknown;
function api(confirm: Confirm = () => ({ bookingId: 'bk-1', pnr: 'ABC123', status: 'ticketed', source: 'lifecycle' })) {
    post.mockImplementation(async (path: string) => {
        if (path === '/flights/book') return { clientSecret: 'cs_1', sessionId: 'sess-1', paymentIntentId: 'pi_1' };
        if (path === '/flights/confirm') return confirm();
        throw new Error(`unexpected POST ${path}`);
    });
}

const renderPage = () =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><CheckoutPage /></NextIntlClientProvider>);

function fillPassenger() {
    const type = (placeholder: string, value: string) =>
        fireEvent.change(screen.getAllByPlaceholderText(placeholder)[0], { target: { value } });
    type('First name', 'Juan');
    type('Last name', 'Cruz');
    type('Email', 'juan@example.com');
    type('Phone', '+639171234567');
    type('Date of birth', '1990-01-01');
    type('Passport number', 'P1234567');
    type('Passport expiry', '2031-01-01');
    type('Nationality (e.g. PH)', 'PH');
    fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'M' } });
}

/** Details, then the card. */
async function payForFlight() {
    renderPage();
    fillPassenger();
    fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }));
    fireEvent.click(await screen.findByRole('button', { name: /pay usd 250/i }));
}

const confirmCalls = () => post.mock.calls.filter((c) => c[0] === '/flights/confirm');

beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { email: 'juan@example.com', first_name: '', last_name: '' };
    query = new URLSearchParams(FLIGHT_QUERY).toString();
    api();
});

// ── the tests ────────────────────────────────────────────────────────────────

describe('the payment step', () => {
    it('says the card is held now and charged only when the airline confirms', async () => {
        renderPage();
        fillPassenger();
        fireEvent.click(screen.getByRole('button', { name: /confirm booking/i }));

        expect(await screen.findByText(/charged only once the airline confirms your ticket/i)).toBeInTheDocument();
    });
});

describe('after the card', () => {
    it('confirms the booking it was told about', async () => {
        await payForFlight();

        await waitFor(() => expect(confirmCalls()).toHaveLength(1));
        expect(confirmCalls()[0][1]).toEqual({ paymentIntentId: 'pi_1', sessionId: 'sess-1' });
        expect(await screen.findByText('bk-1')).toBeInTheDocument();
    });

    it('shows a booking the airline has not settled yet as one being confirmed, with the way to their trips', async () => {
        api(() => { throw httpError(409, { error: 'BOOKING_PROCESSING', message: 'Still confirming.', pending: true, needsReview: false, sessionId: 'sess-1' }); });

        await payForFlight();

        expect(await screen.findByText(/the airline is confirming your ticket/i)).toBeInTheDocument();
        expect(screen.getByText(/don't pay again/i)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /view my trips/i }));
        expect(push).toHaveBeenCalledWith('/trips');
    });

    it('says a person is finishing it when it is under review — and never that the card was not charged', async () => {
        api(() => { throw httpError(409, { error: 'BOOKING_PROCESSING', message: 'Being confirmed.', pending: true, needsReview: true }); });

        await payForFlight();

        expect(await screen.findByText(/we're confirming this with the airline/i)).toBeInTheDocument();
        expect(screen.queryByText(/not been charged|hasn't been taken/i)).not.toBeInTheDocument();
    });

    it('says the fare rose, with both prices, that nothing was charged, and goes back to the details', async () => {
        api(() => { throw httpError(409, { error: 'PRICE_CHANGED', message: 'x', oldPrice: 100, newPrice: 140, currency: 'USD' }); });

        await payForFlight();

        expect(await screen.findByText(/changed from USD 100 to USD 140/i)).toBeInTheDocument();
        expect(screen.getByText(/hold on your card has been released/i)).toBeInTheDocument();
        // The PaymentIntent behind the card form was voided: there is nothing left to pay with.
        expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /confirm booking/i })).toBeInTheDocument();
    });

    it('says the fare sold out, that nothing was charged, and goes back to the details', async () => {
        api(() => { throw httpError(410, { error: 'OFFER_EXPIRED', message: 'x' }); });

        await payForFlight();

        expect(await screen.findByText(/sold out before the airline could confirm it/i)).toBeInTheDocument();
        expect(screen.getByText(/hold on your card has been released/i)).toBeInTheDocument();
        expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    });

    it('relays any other refusal in the server\'s words, and goes back to the details', async () => {
        api(() => { throw httpError(400, { error: 'DUFFEL_ORDER_FAILED', message: 'Passenger name is invalid. Your card has not been charged.' }); });

        await payForFlight();

        expect(await screen.findByText('Passenger name is invalid. Your card has not been charged.')).toBeInTheDocument();
        expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
    });
});
