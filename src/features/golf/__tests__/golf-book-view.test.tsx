import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useSearchStore } from '@/shared/stores/search.store';
import { useAuthStore } from '@/shared/auth/store';
import type { StartedGolfBooking, TeeTimeQuote } from '@/features/golf/types';

const api = vi.hoisted(() => ({ fetchTeeTimeQuote: vi.fn(), startGolfBooking: vi.fn() }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const stripe = vi.hoisted(() => ({ confirmPayment: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);
vi.mock('@/i18n/navigation', () => ({
    useRouter: () => nav,
    Link: ({ children, href, replace, ...rest }: { children: React.ReactNode; href: string; replace?: boolean }) =>
        <a href={href} data-replace={replace} {...rest}>{children}</a>,
}));
vi.mock('@/features/landing/components/landing-header', () => ({ LandingHeader: () => null }));
vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(async () => ({})) }));
vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
    PaymentElement: () => <div data-testid="payment-element" />,
    useStripe: () => stripe,
    useElements: () => ({}),
}));

import { GolfBookView } from '@/features/golf/components/golf-book-view';

const B = en.golf.booking;
const TEE = '0b6c7a2e-2222-4a5b-9c3d-000000000002';

const quote: TeeTimeQuote = {
    teeTimeId: TEE, course: { slug: 'fuji', name: 'Fuji Lakeside', city: 'Gotemba', country: 'Japan', imageUrl: null },
    startsAt: '2026-11-20T00:00:00Z', timezone: 'Asia/Tokyo', players: 2, spotsLeft: 4,
    currency: 'KRW', greenFee: 200000, extras: [], extrasTotal: 0, extraOffers: [], serviceFee: 4124, total: 204124,
    freeCancelUntil: '2099-11-18T00:00:00Z',
};

const started = (over: Partial<StartedGolfBooking> = {}): StartedGolfBooking => ({
    reference: 'CG-ABC123', clientSecret: 'secret', status: 'held',
    holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    currency: 'KRW', greenFee: 200000, extras: [], extrasTotal: 0, serviceFee: 4124, total: 204124, ...over,
});

const view = () => <GolfBookView slug="fuji" teeTimeId={TEE} players={2} />;
const proceed = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(await screen.findByRole('button', { name: B.continue }));

beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ userCurrency: 'KRW' });
    useAuthStore.setState({ user: { id: 'u1', email: 'pat@example.com', first_name: 'Pat', last_name: 'Golfer' } as never, isLoading: false });
    api.fetchTeeTimeQuote.mockResolvedValue(quote);
    api.startGolfBooking.mockResolvedValue(started());
});

afterEach(() => vi.useRealTimers());

describe('GolfBookView', () => {
    it('sends a signed-out visitor to sign in and back', async () => {
        useAuthStore.setState({ user: null, isLoading: false });
        renderWithIntl(view());
        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith(expect.stringContaining('/login?redirect=')));
        expect(api.fetchTeeTimeQuote).not.toHaveBeenCalled();
    });

    it('waits for the session before deciding anything', () => {
        useAuthStore.setState({ user: null, isLoading: true });
        renderWithIntl(view());
        expect(nav.replace).not.toHaveBeenCalled();
    });

    it('shows the price lines from the quote, with exact figures, and the lead player filled in', async () => {
        renderWithIntl(view());
        expect(await screen.findByText('₩204,124')).toBeInTheDocument();
        expect(screen.getByText('₩200,000')).toBeInTheDocument();
        expect(screen.getByText('₩4,124')).toBeInTheDocument();
        expect(screen.getByLabelText(B.leadName)).toHaveValue('Pat Golfer');
        expect(screen.getByText('Fuji Lakeside')).toBeInTheDocument();
        // On the course's clock: 00:00 UTC is 9:00 AM in Tokyo.
        expect(screen.getByText('9:00 AM')).toBeInTheDocument();
        expect(api.fetchTeeTimeQuote).toHaveBeenCalledWith(TEE, { players: 2, currency: 'KRW', extras: '' });
    });

    it('says the card is only charged once the course confirms', async () => {
        renderWithIntl(view());
        expect(await screen.findByText(B.howItWorks, { exact: false })).toBeInTheDocument();
    });

    it('takes no spots until the visitor continues, then asks for exactly what they were shown', async () => {
        const user = userEvent.setup();
        renderWithIntl(view());
        await screen.findByText('₩204,124');
        expect(api.startGolfBooking).not.toHaveBeenCalled();
        await proceed(user);
        expect(api.startGolfBooking).toHaveBeenCalledWith({
            teeTimeId: TEE, players: 2, leadName: 'Pat Golfer', currency: 'KRW', shownTotal: 204124, extras: [],
        });
        expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Request this tee time · ₩204,124' })).toBeInTheDocument();
    });

    it('needs a name for the lead player', async () => {
        const user = userEvent.setup();
        renderWithIntl(view());
        await user.clear(await screen.findByLabelText(B.leadName));
        await proceed(user);
        expect(await screen.findByRole('alert')).toHaveTextContent(B.leadNameRequired);
        expect(api.startGolfBooking).not.toHaveBeenCalled();
    });

    it('sends the name typed, and keeps it when the session updates', async () => {
        const user = userEvent.setup();
        renderWithIntl(view());
        const name = await screen.findByLabelText(B.leadName);
        await user.clear(name);
        await user.type(name, 'Sam Other');
        act(() => useAuthStore.setState({ user: { id: 'u1', email: 'pat@example.com', first_name: 'Pat', last_name: 'Golfer' } as never }));
        expect(name).toHaveValue('Sam Other');
        await proceed(user);
        expect(api.startGolfBooking).toHaveBeenCalledWith(expect.objectContaining({ leadName: 'Sam Other' }));
    });

    it('shows the new figures and stays put when the price moved, charging nothing', async () => {
        api.startGolfBooking.mockRejectedValueOnce(Object.assign(new Error('changed'), {
            status: 409, code: 'PRICE_CHANGED', body: { currency: 'KRW', greenFee: 210000, serviceFee: 4300, total: 214300 },
        }));
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        expect(await screen.findByRole('status')).toHaveTextContent(B.priceChanged);
        expect(screen.getByText('₩214,300')).toBeInTheDocument();
        expect(screen.queryByTestId('payment-element')).toBeNull();
    });

    it('asks for the new total on the second try', async () => {
        api.startGolfBooking.mockRejectedValueOnce(Object.assign(new Error('changed'), {
            status: 409, code: 'PRICE_CHANGED', body: { currency: 'KRW', greenFee: 210000, serviceFee: 4300, total: 214300 },
        }));
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        await screen.findByRole('status');
        await proceed(user);
        expect(api.startGolfBooking).toHaveBeenLastCalledWith(expect.objectContaining({ shownTotal: 214300 }));
    });

    it('explains when the tee time has gone between the quote and starting', async () => {
        api.startGolfBooking.mockRejectedValueOnce(Object.assign(new Error('no'), { status: 409, code: 'TEE_TIME_UNAVAILABLE', body: {} }));
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        expect(await screen.findByText(B.unavailableTitle)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: B.pickAnother })).toHaveAttribute('href', '/golf/fuji?players=2');
    });

    it('goes back to the course on the day and party in hand, and takes the checkout out of history', async () => {
        api.fetchTeeTimeQuote.mockRejectedValueOnce(Object.assign(new Error('gone'), { status: 409, body: {} }));
        renderWithIntl(<GolfBookView slug="fuji" teeTimeId={TEE} players={3} date="2026-11-20" />);
        expect(await screen.findByText(B.unavailableTitle)).toBeInTheDocument();
        for (const name of [B.backToCourse, B.pickAnother]) {
            const link = screen.getByRole('link', { name });
            expect(link).toHaveAttribute('href', '/golf/fuji?date=2026-11-20&players=3');
            expect(link).toHaveAttribute('data-replace', 'true');
        }
    });

    it('says how many spots are left when the party no longer fits', async () => {
        api.fetchTeeTimeQuote.mockRejectedValueOnce(Object.assign(new Error('no'), { status: 409, code: 'NOT_ENOUGH_SPOTS', body: { spotsLeft: 1 } }));
        renderWithIntl(view());
        expect(await screen.findByText('Only 1 spot is left on this tee time. Nothing was charged.')).toBeInTheDocument();
    });

    it('offers another try when the quote cannot load', async () => {
        api.fetchTeeTimeQuote.mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 }));
        const user = userEvent.setup();
        renderWithIntl(view());
        await user.click(await screen.findByRole('button', { name: en.golf.retry }));
        expect(await screen.findByText('₩204,124')).toBeInTheDocument();
    });

    it('keeps the payment page open with a clear message when the payment cannot start', async () => {
        api.startGolfBooking.mockRejectedValueOnce(Object.assign(new Error('down'), { status: 502, code: 'PAYMENT_UNAVAILABLE' }));
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        expect(await screen.findByRole('alert')).toHaveTextContent(B.startError);
        expect(screen.getByRole('button', { name: B.continue })).toBeEnabled();
    });

    it('goes straight to the booking when the card was already authorised', async () => {
        api.startGolfBooking.mockResolvedValueOnce(started({ clientSecret: null, status: 'requested' }));
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/golf/bookings/CG-ABC123'));
    });

    it('goes to the booking once the card is authorised', async () => {
        stripe.confirmPayment.mockResolvedValueOnce({ paymentIntent: { status: 'requires_capture' } });
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        await user.click(await screen.findByRole('button', { name: /^Request this tee time/ }));
        expect(stripe.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({ redirect: 'if_required' }));
        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/golf/bookings/CG-ABC123'));
    });

    it("stays on the form with Stripe's reason when the card is refused", async () => {
        stripe.confirmPayment.mockResolvedValueOnce({ error: { message: 'Your card was declined.' } });
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        await user.click(await screen.findByRole('button', { name: /^Request this tee time/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Your card was declined.');
        expect(nav.replace).not.toHaveBeenCalled();
    });

    it('counts the hold down, and says when it has run out', async () => {
        api.startGolfBooking.mockResolvedValueOnce(started({ holdExpiresAt: new Date(Date.now() + 90_000).toISOString() }));
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        expect(await screen.findByText('Your spots are held for 1:30.')).toBeInTheDocument();
    });

    it('offers another time once the hold has run out', async () => {
        api.startGolfBooking.mockResolvedValueOnce(started({ holdExpiresAt: new Date(Date.now() - 1000).toISOString() }));
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        expect(await screen.findByText(B.holdRanOutTitle)).toBeInTheDocument();
        expect(screen.queryByTestId('payment-element')).toBeNull();
        expect(screen.getByRole('link', { name: B.pickAnother })).toHaveAttribute('data-replace', 'true');
    });

    it('does not re-quote once the hold is taken, whatever the header currency does', async () => {
        const user = userEvent.setup();
        renderWithIntl(view());
        await proceed(user);
        await screen.findByTestId('payment-element');
        api.fetchTeeTimeQuote.mockClear();
        act(() => useSearchStore.setState({ userCurrency: 'USD' }));
        await new Promise((r) => setTimeout(r, 20));
        expect(api.fetchTeeTimeQuote).not.toHaveBeenCalled();
        expect(screen.getByText('₩204,124')).toBeInTheDocument();
    });

    it('says until when it can be cancelled for free', async () => {
        renderWithIntl(view());
        // On the course's clock: 00:00 UTC is 9:00 AM in Tokyo.
        expect(await screen.findByText(/Free cancellation until .* 18 Nov 2099 9:00 AM/)).toBeInTheDocument();
    });

    it('says plainly when free cancellation has already passed for this tee time', async () => {
        api.fetchTeeTimeQuote.mockResolvedValueOnce({ ...quote, freeCancelUntil: '2001-01-01T00:00:00Z' });
        renderWithIntl(view());
        expect(await screen.findByText(B.noFreeCancel, { exact: false })).toBeInTheDocument();
    });
});

describe('GolfBookView extras', () => {
    const OFFERS = [{ code: 'caddie' as const, price: 40000 }, { code: 'cart' as const, price: 25000 }];
    const withOffers: TeeTimeQuote = { ...quote, extraOffers: OFFERS };
    const withCaddie: TeeTimeQuote = {
        ...withOffers, extras: [{ code: 'caddie', quantity: 1, total: 40000 }], extrasTotal: 40000, serviceFee: 4924, total: 244924,
    };
    const addCaddie = /Add one: Caddie/;

    beforeEach(() => {
        window.history.replaceState(null, '', '/golf/fuji/book');
        api.fetchTeeTimeQuote.mockImplementation(async (_id: string, opts: { extras?: string }) =>
            (opts.extras === 'caddie:1' ? withCaddie : withOffers));
    });

    it('offers nothing to a course with no extras', async () => {
        api.fetchTeeTimeQuote.mockImplementation(async () => quote);
        renderWithIntl(view());
        await screen.findByRole('button', { name: B.continue });
        expect(screen.queryByText(B.extrasHeading)).toBeNull();
    });

    it('lists what the course offers, with its price each', async () => {
        renderWithIntl(view());
        expect(await screen.findByText(B.extrasHeading)).toBeInTheDocument();
        expect(screen.getByText('Caddie')).toBeInTheDocument();
        expect(screen.getByText('₩40,000 each')).toBeInTheDocument();
        expect(screen.getByText('Golf cart')).toBeInTheDocument();
    });

    it('reprices without leaving the page, and adds the line to the summary', async () => {
        const user = userEvent.setup();
        renderWithIntl(view());
        await user.click(await screen.findByRole('button', { name: addCaddie }));
        expect(await screen.findByText('Caddie × 1')).toBeInTheDocument();
        expect(screen.getAllByText('₩40,000')).not.toHaveLength(0);
        expect(screen.getByText('₩244,924')).toBeInTheDocument();
        expect(api.fetchTeeTimeQuote).toHaveBeenLastCalledWith(TEE, { players: 2, currency: 'KRW', extras: 'caddie:1' });
        expect(window.location.search).toContain('extras=');
    });

    it('will not take the hold until the new total is on screen', async () => {
        let answer: (q: TeeTimeQuote) => void = () => undefined;
        const user = userEvent.setup();
        renderWithIntl(view());
        const add = await screen.findByRole('button', { name: addCaddie });
        api.fetchTeeTimeQuote.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
        await user.click(add);
        expect(screen.getByRole('button', { name: B.continue })).toBeDisabled();
        await act(async () => answer(withCaddie));
        await waitFor(() => expect(screen.getByRole('button', { name: B.continue })).toBeEnabled());
    });

    it('sends the extras it priced, with the total it showed', async () => {
        const user = userEvent.setup();
        renderWithIntl(view());
        await user.click(await screen.findByRole('button', { name: addCaddie }));
        await screen.findByText('₩244,924');
        await proceed(user);
        expect(api.startGolfBooking).toHaveBeenCalledWith(expect.objectContaining({
            shownTotal: 244924, extras: [{ code: 'caddie', quantity: 1 }],
        }));
    });

    it('stops at one per player, and can be taken off again', async () => {
        const user = userEvent.setup();
        renderWithIntl(view());
        const add = await screen.findByRole('button', { name: addCaddie });
        await user.click(add);
        await user.click(add);
        expect(add).toBeDisabled();
        const remove = screen.getByRole('button', { name: /Remove one: Caddie/ });
        await user.click(remove);
        await user.click(remove);
        expect(remove).toBeDisabled();
        await waitFor(() => expect(api.fetchTeeTimeQuote).toHaveBeenLastCalledWith(TEE, { players: 2, currency: 'KRW', extras: '' }));
        expect(window.location.search).not.toContain('extras');
    });

    it('keeps what the address asked for, after a reload or a trip through sign-in', async () => {
        renderWithIntl(<GolfBookView slug="fuji" teeTimeId={TEE} players={2} extras="caddie:1" />);
        expect(await screen.findByText('Caddie × 1')).toBeInTheDocument();
        expect(api.fetchTeeTimeQuote).toHaveBeenCalledWith(TEE, { players: 2, currency: 'KRW', extras: 'caddie:1' });
    });

    it('says so when an extra has gone, and shows what can still be had', async () => {
        api.startGolfBooking.mockRejectedValueOnce(Object.assign(new Error('gone'), { status: 409, code: 'EXTRAS_UNAVAILABLE' }));
        const user = userEvent.setup();
        renderWithIntl(view());
        await screen.findByText(B.extrasHeading);
        const calls = api.fetchTeeTimeQuote.mock.calls.length;
        await proceed(user);
        expect(await screen.findByText(B.extrasUnavailable)).toBeInTheDocument();
        await waitFor(() => expect(api.fetchTeeTimeQuote.mock.calls.length).toBeGreaterThan(calls));
    });

    it('locks them once the hold is taken, and keeps the line on the summary', async () => {
        api.startGolfBooking.mockResolvedValue(started({
            extras: [{ code: 'caddie', quantity: 1, total: 40000 }], extrasTotal: 40000, serviceFee: 4924, total: 244924,
        }));
        const user = userEvent.setup();
        renderWithIntl(<GolfBookView slug="fuji" teeTimeId={TEE} players={2} extras="caddie:1" />);
        await screen.findByText('Caddie × 1');
        await proceed(user);
        await screen.findByTestId('payment-element');
        expect(screen.queryByText(B.extrasHeading)).toBeNull();
        expect(screen.getByText('Caddie × 1')).toBeInTheDocument();
    });
});
