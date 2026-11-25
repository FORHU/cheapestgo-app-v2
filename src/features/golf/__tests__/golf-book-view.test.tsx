import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
// The Golf Services picker (api-v2's separate /api/v1/golf/services mock catalog) is mocked here
// too, so these real-booking tests never make a real network call to it.
const mockGolfApi = vi.hoisted(() => ({
    listServices: vi.fn(), bookService: vi.fn(), getServiceBooking: vi.fn(), cancelServiceBooking: vi.fn(),
}));
vi.mock('@/features/golf/api/golf.api', () => api);
vi.mock('@/features/golf-api-demo/api/golfMockApi.client', () => ({ golfMockApi: mockGolfApi }));
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
    mockGolfApi.listServices.mockResolvedValue({ data: { services: [], total: 0 }, status: 200 });
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

describe('GolfBookView — Additional Golf Services', () => {
    const SB = B.services;
    const SERVICES = [
        { id: 'equip-glove', category: 'equipment' as const, bookingMode: 'product' as const, name: 'Golf Glove', description: 'A glove.', price: 15, currency: 'USD', unit: 'per item' },
        { id: 'lesson-private-coaching', category: 'lesson' as const, bookingMode: 'appointment' as const, name: 'Private 1-on-1 Coaching', description: 'A lesson.', price: 75, currency: 'USD', unit: 'per hour' },
        { id: 'fitting-standard', category: 'club_fitting' as const, bookingMode: 'appointment' as const, name: 'Standard Club Fitting', description: 'A fitting.', price: 60, currency: 'USD', unit: 'per session' },
        { id: 'simulation-bay-hour', category: 'simulation' as const, bookingMode: 'appointment' as const, name: 'Indoor Simulator Bay', description: 'A bay.', price: 30, currency: 'USD', unit: 'per hour' },
        { id: 'tournament-monthly-medal', category: 'tournament' as const, bookingMode: 'inquiry' as const, name: 'Monthly Medal Competition', description: 'A competition.', price: 25, currency: 'USD', unit: 'per entry' },
        { id: 'tournament-corporate-cup', category: 'tournament' as const, bookingMode: 'inquiry' as const, name: 'Corporate Golf Cup', description: 'A cup.', price: 150, currency: 'USD', unit: 'per team' },
        { id: 'membership-individual', category: 'membership' as const, bookingMode: 'inquiry' as const, name: 'Annual Individual Membership', description: 'A membership.', price: 1200, currency: 'USD', unit: 'per year' },
        { id: 'membership-family', category: 'membership' as const, bookingMode: 'inquiry' as const, name: 'Family Membership', description: 'A membership.', price: 2000, currency: 'USD', unit: 'per year' },
        { id: 'event-corporate-outing', category: 'event' as const, bookingMode: 'inquiry' as const, name: 'Corporate Golf Outing', description: 'An outing.', price: null, currency: 'USD', unit: 'quote' },
        { id: 'event-private-group', category: 'event' as const, bookingMode: 'inquiry' as const, name: 'Private Group Booking', description: 'A private group booking.', price: null, currency: 'USD', unit: 'quote' },
    ];

    const quoteUSD: TeeTimeQuote = { ...quote, currency: 'USD', greenFee: 200, extrasTotal: 0, serviceFee: 6, total: 206 };

    function rowFor(name: string): HTMLElement {
        const row = screen.getByText(name).closest('li');
        if (!row) throw new Error(`no service row for "${name}"`);
        return row as HTMLElement;
    }
    /** Click Add/Book/Request — opens the configuring fields. Not yet in the invoice/total. */
    async function openService(user: ReturnType<typeof userEvent.setup>, name: string) {
        const row = rowFor(name);
        await user.click(within(row).getByRole('button'));
        return row;
    }
    async function clickConfirm(user: ReturnType<typeof userEvent.setup>, row: HTMLElement) {
        await user.click(within(row).getByRole('button', { name: SB.confirmButton }));
    }
    /** The common case: open, fill in a valid preferred date and/or participant count if this
     *  service has those fields at all (required or not — Confirm is blocked without them for a
     *  service that requires them), leave everything else at its default, confirm. */
    async function addAndConfirm(user: ReturnType<typeof userEvent.setup>, name: string) {
        const row = await openService(user, name);
        const dateInput = row.querySelector('input[type="date"]');
        if (dateInput) fireEvent.change(dateInput, { target: { value: '2026-12-02' } });
        const partySizeInput = row.querySelector('input[id^="party-"]');
        if (partySizeInput) fireEvent.change(partySizeInput, { target: { value: '4' } });
        await clickConfirm(user, row);
        return row;
    }
    async function setQuantity(user: ReturnType<typeof userEvent.setup>, row: HTMLElement, label: string, name: string, value: number) {
        const input = within(row).getByRole('spinbutton', { name: `${label} — ${name}` });
        await user.clear(input);
        await user.type(input, String(value));
    }
    async function clickEdit(user: ReturnType<typeof userEvent.setup>, row: HTMLElement) {
        await user.click(within(row).getByRole('button', { name: SB.editButton }));
    }
    async function clickSaveChanges(user: ReturnType<typeof userEvent.setup>, row: HTMLElement) {
        await user.click(within(row).getByRole('button', { name: SB.saveChanges }));
    }
    async function clickCancelEdit(user: ReturnType<typeof userEvent.setup>, row: HTMLElement) {
        await user.click(within(row).getByRole('button', { name: SB.cancel }));
    }
    /** Remove always goes through the confirmation dialog — this drives it to completion. */
    async function removeWithConfirm(user: ReturnType<typeof userEvent.setup>, row: HTMLElement) {
        await user.click(within(row).getByRole('button', { name: SB.remove }));
        await user.click(within(row).getByRole('button', { name: SB.removeService }));
    }

    beforeEach(() => {
        mockGolfApi.listServices.mockResolvedValue({ data: { services: SERVICES, total: SERVICES.length }, status: 200 });
    });

    it('appears below Extras and above the Lead Player section, without affecting the tee-time total before anything is confirmed', async () => {
        api.fetchTeeTimeQuote.mockImplementation(async () => ({ ...quote, extraOffers: [{ code: 'caddie' as const, price: 40000 }] }));
        renderWithIntl(view());
        await screen.findByText('₩204,124');

        expect(await screen.findByRole('heading', { name: SB.heading })).toBeInTheDocument();
        const order = Array.from(document.body.querySelectorAll('h2')).map((h) => h.textContent);
        expect(order.indexOf(B.extrasHeading)).toBeLessThan(order.indexOf(SB.heading));

        expect(screen.getByLabelText(B.leadName)).toBeInTheDocument();
        expect(screen.getByText('₩204,124')).toBeInTheDocument();
    });

    it('shows every service category regardless of which course it is', async () => {
        renderWithIntl(view());
        await screen.findByRole('heading', { name: SB.heading });
        for (const name of SERVICES.map((s) => s.name)) expect(screen.getByText(name)).toBeInTheDocument();
    });

    describe('service management: configure, confirm, edit, remove', () => {
        it('opening a service shows configurable fields but does not yet affect the Final total', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Golf Glove');
            expect(within(row).getByRole('spinbutton', { name: `${SB.quantity} — Golf Glove` })).toBeInTheDocument();
            expect(within(row).getByRole('button', { name: SB.confirmButton })).toBeInTheDocument();
            expect(screen.getByText('$206.00')).toBeInTheDocument(); // unchanged — nothing confirmed yet
        });

        it('confirming collapses the fields, shows a Confirmed indicator, and adds it to the Final total — without booking anything', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await addAndConfirm(user, 'Golf Glove');
            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(within(row).queryByRole('spinbutton')).toBeNull(); // fields collapsed
            expect(within(row).getByRole('button', { name: SB.editButton })).toBeInTheDocument();
            expect(within(row).getByRole('button', { name: SB.remove })).toBeInTheDocument();
            expect(await screen.findByText('$221.00')).toBeInTheDocument(); // 206 + 15×1
            expect(mockGolfApi.bookService).not.toHaveBeenCalled();
        });

        it('editing reopens the fields pre-filled with the confirmed configuration, and Save Changes recalculates the total', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await addAndConfirm(user, 'Golf Glove'); // quantity 1 → $221.00
            await screen.findByText('$221.00');

            await clickEdit(user, row);
            expect(within(row).getByRole('spinbutton', { name: `${SB.quantity} — Golf Glove` })).toHaveValue(1);
            await setQuantity(user, row, SB.quantity, 'Golf Glove', 3);
            await clickSaveChanges(user, row);

            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(await screen.findByText('$251.00')).toBeInTheDocument(); // 206 + 15×3
        });

        it('cancelling an edit discards the change and keeps the previously confirmed configuration and subtotal', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await addAndConfirm(user, 'Golf Glove');
            await screen.findByText('$221.00');

            await clickEdit(user, row);
            await setQuantity(user, row, SB.quantity, 'Golf Glove', 5);
            await clickCancelEdit(user, row);

            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(screen.getByText('$221.00')).toBeInTheDocument(); // unchanged — the edit was discarded
            expect(screen.queryByText('$281.00')).toBeNull(); // 15×5 never applied

            // The discarded value doesn't linger either: editing again starts from 1, not 5.
            await clickEdit(user, row);
            expect(within(row).getByRole('spinbutton', { name: `${SB.quantity} — Golf Glove` })).toHaveValue(1);
        });

        it('removing asks for confirmation; Keep Service leaves the booking untouched', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await addAndConfirm(user, 'Golf Glove');
            await screen.findByText('$221.00');

            await user.click(within(row).getByRole('button', { name: SB.remove }));
            expect(within(row).getByText(SB.removeConfirmQuestion)).toBeInTheDocument();
            await user.click(within(row).getByRole('button', { name: SB.keepService }));

            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(screen.getByText('$221.00')).toBeInTheDocument(); // still there
        });

        it('removing and confirming Remove Service takes it out of the Final total, preserving every other confirmed service', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const gloveRow = await addAndConfirm(user, 'Golf Glove'); // +15
            await addAndConfirm(user, 'Monthly Medal Competition'); // +25
            expect(await screen.findByText('$246.00')).toBeInTheDocument(); // 206 + 15 + 25

            await removeWithConfirm(user, gloveRow);
            // The catalog entry itself still shows (back to "Buy", unselected) — only the
            // confirmed selection and its charge are gone.
            expect(within(gloveRow).queryByText(SB.confirmed)).toBeNull();
            expect(within(gloveRow).getByRole('button', { name: SB.actionBuy })).toBeInTheDocument();
            expect(await screen.findByText('$231.00')).toBeInTheDocument(); // 206 + 25 — the medal is untouched
        });

        it('confirms multiple services independently — editing one does not disturb another', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const gloveRow = await addAndConfirm(user, 'Golf Glove');
            const medalRow = await addAndConfirm(user, 'Monthly Medal Competition');
            await screen.findByText('$246.00'); // 206 + 15 + 25

            await clickEdit(user, gloveRow);
            await setQuantity(user, gloveRow, SB.quantity, 'Golf Glove', 2);
            await clickSaveChanges(user, gloveRow);

            expect(await screen.findByText('$261.00')).toBeInTheDocument(); // 206 + 30 + 25
            expect(within(medalRow).getByText(SB.confirmed)).toBeInTheDocument(); // the medal's own state is untouched
        });
    });

    describe('required preferred date', () => {
        it('blocks Confirm and shows a warning when an appointment has no date — and never adds it to the Final total', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Private 1-on-1 Coaching');
            await clickConfirm(user, row); // no date filled in
            expect(within(row).getByText(SB.preferredDateRequired)).toBeInTheDocument();
            expect(within(row).queryByText(SB.confirmed)).toBeNull();
            expect(screen.getByText('$206.00')).toBeInTheDocument(); // unchanged
        });

        it('blocks Confirm and shows a warning when an inquiry (tournament/event) has no date', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Monthly Medal Competition');
            await clickConfirm(user, row);
            expect(within(row).getByText(SB.preferredDateRequired)).toBeInTheDocument();
            expect(within(row).queryByText(SB.confirmed)).toBeNull();
        });

        it('blocks Confirm and shows the same warning for a past date', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Private 1-on-1 Coaching');
            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2020-01-01' } });
            await clickConfirm(user, row);
            expect(within(row).getByText(SB.preferredDateRequired)).toBeInTheDocument();
            expect(within(row).queryByText(SB.confirmed)).toBeNull();
        });

        it('confirms successfully once a valid future date is chosen, and the warning disappears', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Private 1-on-1 Coaching');
            await clickConfirm(user, row); // first attempt, no date — triggers the warning
            expect(within(row).getByText(SB.preferredDateRequired)).toBeInTheDocument();

            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2026-12-02' } });
            expect(within(row).queryByText(SB.preferredDateRequired)).toBeNull(); // clears automatically
            await clickConfirm(user, row);

            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(await screen.findByText('$281.00')).toBeInTheDocument(); // 206 + 75
        });

        it('blocks Save Changes if an already-confirmed service\'s date is cleared during editing, keeping the prior confirmed date', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await addAndConfirm(user, 'Private 1-on-1 Coaching'); // confirmed with 2026-12-02
            await screen.findByText('$281.00');

            await clickEdit(user, row);
            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '' } });
            await clickSaveChanges(user, row);

            expect(within(row).getByText(SB.preferredDateRequired)).toBeInTheDocument();
            // Still in the editing state (Save Changes was blocked) — the prior confirmed date was
            // never discarded by the failed save.
            expect(within(row).queryByText(SB.confirmed)).toBeNull();
            await clickCancelEdit(user, row);
            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(screen.getByText('$281.00')).toBeInTheDocument(); // total never changed
        });

        it('does not require or validate a date for a product (equipment)', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await addAndConfirm(user, 'Golf Glove');
            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(within(row).queryByText(SB.preferredDateRequired)).toBeNull();
        });

        it('blocks Confirm and shows the membership-specific warning when Annual Individual Membership has no date', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Annual Individual Membership');
            await clickConfirm(user, row); // no date filled in
            expect(within(row).getByText(SB.preferredDateRequiredMembership)).toBeInTheDocument();
            expect(within(row).queryByText(SB.confirmed)).toBeNull();
            expect(screen.getByText('$206.00')).toBeInTheDocument(); // unchanged
        });

        it('confirms Annual Individual Membership once a valid future date is chosen', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await addAndConfirm(user, 'Annual Individual Membership');
            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(await screen.findByText('$1,406.00')).toBeInTheDocument(); // 206 + 1200
        });

        it('blocks Confirm and shows the membership-specific warning when Family Membership has no date', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Family Membership');
            await clickConfirm(user, row); // no date filled in
            expect(within(row).getByText(SB.preferredDateRequiredMembership)).toBeInTheDocument();
            expect(within(row).queryByText(SB.confirmed)).toBeNull();
            expect(screen.getByText('$206.00')).toBeInTheDocument(); // unchanged
        });

        it('rejects a past date for a membership, same as any other service', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Family Membership');
            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2020-01-01' } });
            await clickConfirm(user, row);
            expect(within(row).getByText(SB.preferredDateRequiredMembership)).toBeInTheDocument();
            expect(within(row).queryByText(SB.confirmed)).toBeNull();
        });

        it('confirms Family Membership once a valid future date is chosen, and the warning disappears', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Family Membership');
            await clickConfirm(user, row); // first attempt, no date — triggers the warning
            expect(within(row).getByText(SB.preferredDateRequiredMembership)).toBeInTheDocument();

            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2026-12-02' } });
            expect(within(row).queryByText(SB.preferredDateRequiredMembership)).toBeNull(); // clears automatically
            await clickConfirm(user, row);

            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(await screen.findByText('$2,206.00')).toBeInTheDocument(); // 206 + 2000 (default full package)
        });
    });

    describe('required participant count (tournaments and events)', () => {
        async function openWithDate(user: ReturnType<typeof userEvent.setup>, name: string) {
            const row = await openService(user, name);
            const dateInput = row.querySelector('input[type="date"]');
            if (dateInput) fireEvent.change(dateInput, { target: { value: '2026-12-02' } });
            return row;
        }

        it('blocks Confirm and shows a warning when a tournament entry has no participant count', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openWithDate(user, 'Monthly Medal Competition');
            await clickConfirm(user, row);
            expect(within(row).getByText(SB.partySizeRequired)).toBeInTheDocument();
            expect(within(row).queryByText(SB.confirmed)).toBeNull();
            expect(screen.getByText('$206.00')).toBeInTheDocument(); // unchanged
        });

        it('blocks Confirm for zero, negative and decimal participant counts', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openWithDate(user, 'Monthly Medal Competition');
            const partySize = row.querySelector('input[id^="party-"]')!;

            for (const value of ['0', '-4', '2.5']) {
                fireEvent.change(partySize, { target: { value } });
                await clickConfirm(user, row);
                expect(within(row).getByText(SB.partySizeRequired)).toBeInTheDocument();
                expect(within(row).queryByText(SB.confirmed)).toBeNull();
            }
        });

        it('confirms successfully once a valid positive whole number is entered, and the warning disappears', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openWithDate(user, 'Monthly Medal Competition');
            await clickConfirm(user, row); // first attempt, no participant count — triggers the warning
            expect(within(row).getByText(SB.partySizeRequired)).toBeInTheDocument();

            fireEvent.change(row.querySelector('input[id^="party-"]')!, { target: { value: '4' } });
            expect(within(row).queryByText(SB.partySizeRequired)).toBeNull(); // clears automatically
            await clickConfirm(user, row);

            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(await screen.findByText('$231.00')).toBeInTheDocument(); // 206 + 25
        });

        it('requires both the team count and the participant count for the Corporate Golf Cup — the teams field is retained, not replaced', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openWithDate(user, 'Corporate Golf Cup');
            await setQuantity(user, row, SB.teams, 'Corporate Golf Cup', 2); // teams filled in, participants still missing
            await clickConfirm(user, row);
            expect(within(row).getByText(SB.partySizeRequired)).toBeInTheDocument();
            expect(within(row).queryByText(SB.confirmed)).toBeNull();

            fireEvent.change(row.querySelector('input[id^="party-"]')!, { target: { value: '8' } });
            await clickConfirm(user, row);
            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(await screen.findByText('Corporate Golf Cup (2 teams)')).toBeInTheDocument();
        });

        it('requires a participant count for Corporate Golf Outing and Private Group Booking', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            for (const name of ['Corporate Golf Outing', 'Private Group Booking']) {
                const row = await openWithDate(user, name);
                await clickConfirm(user, row);
                expect(within(row).getByText(SB.partySizeRequired)).toBeInTheDocument();
                expect(within(row).queryByText(SB.confirmed)).toBeNull();
            }
        });

        it('preserves notes and other entered information when confirmation is blocked for a missing participant count', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openWithDate(user, 'Monthly Medal Competition');
            const notes = within(row).getByRole('textbox', { name: `${SB.notes} — Monthly Medal Competition` });
            await user.type(notes, 'Saturday please');
            await clickConfirm(user, row); // blocked — no participant count
            expect(within(row).getByText(SB.partySizeRequired)).toBeInTheDocument();
            expect(notes).toHaveValue('Saturday please'); // nothing was lost
        });

        it('submits the participant count to api-v2 once a confirmed tournament entry is booked', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            mockGolfApi.bookService.mockResolvedValue({
                data: { id: 's1', reference: 'MGS-MEDAL1', serviceId: 'tournament-monthly-medal', category: 'tournament', bookingMode: 'inquiry', name: 'Monthly Medal Competition', leadName: 'Pat Golfer', contactEmail: 'pat@example.com', courseId: 'fuji', currency: 'USD', unitPrice: 25, total: 25, partySize: 4, status: 'confirmed', createdAt: new Date().toISOString() },
                status: 201,
            });
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            await addAndConfirm(user, 'Monthly Medal Competition');
            await proceed(user);

            await waitFor(() => expect(mockGolfApi.bookService).toHaveBeenCalledWith('tournament-monthly-medal', expect.objectContaining({ partySize: 4 })));
        });
    });

    describe('itemized invoice — every confirmed service by its own catalog name', () => {
        it('shows a product with its quantity × unit price, not a generic "Equipment" total', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Golf Glove');
            await setQuantity(user, row, SB.quantity, 'Golf Glove', 2);
            await clickConfirm(user, row);

            // The invoice line reads by catalog name, not a generic "Equipment purchases" sum —
            // "Equipment sales" is still the picker's own category heading, a separate thing.
            expect(await screen.findByText(`Golf Glove (2 × $15.00)`)).toBeInTheDocument();
        });

        it('lists two different confirmed services as two separate rows, each with its own name and price — never merged', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(<GolfBookView slug="fuji" teeTimeId={TEE} players={2} />);
            await screen.findByText('$206.00');

            await addAndConfirm(user, 'Golf Glove');
            await addAndConfirm(user, 'Family Membership');

            expect(await screen.findByText('Golf Glove (1 × $15.00)')).toBeInTheDocument();
            expect(screen.getByText('Family Membership (2 adults, 3 juniors)')).toBeInTheDocument();
        });

        it('shows a tournament entry fee with its entry count, and a team fee with its team count', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const medalRow = await openService(user, 'Monthly Medal Competition');
            await setQuantity(user, medalRow, SB.entries, 'Monthly Medal Competition', 2);
            fireEvent.change(medalRow.querySelector('input[type="date"]')!, { target: { value: '2026-12-02' } });
            fireEvent.change(medalRow.querySelector('input[id^="party-"]')!, { target: { value: '2' } });
            await clickConfirm(user, medalRow);
            await addAndConfirm(user, 'Corporate Golf Cup');

            expect(await screen.findByText('Monthly Medal Competition (2 entries)')).toBeInTheDocument();
            expect(screen.getByText('Corporate Golf Cup (1 team)')).toBeInTheDocument();
        });

        it('shows an appointment service by its session/hour count', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Indoor Simulator Bay');
            await setQuantity(user, row, SB.hours, 'Indoor Simulator Bay', 2);
            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2026-12-02' } });
            await clickConfirm(user, row);

            expect(await screen.findByText('Indoor Simulator Bay (2 hours)')).toBeInTheDocument();
        });

        it('shows a quote-based event by its party size, labelled as a pending quote, excluded from the Final total', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Corporate Golf Outing');
            const partySize = within(row).getByRole('spinbutton', { name: `${SB.partySize} — Corporate Golf Outing` });
            await user.clear(partySize);
            await user.type(partySize, '15');
            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2026-12-02' } });
            await clickConfirm(user, row);

            expect(await screen.findByText('Corporate Golf Outing (15 guests)')).toBeInTheDocument();
            // Shown as pending both in the picker's own recap and in the invoice row.
            expect(screen.getAllByText(SB.quotePending).length).toBeGreaterThanOrEqual(2);
            expect(screen.getByText('$206.00')).toBeInTheDocument(); // unchanged — no number invented
        });

        it('recalculates the invoice and Final total immediately after Save Changes, with no page refresh', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await addAndConfirm(user, 'Golf Glove');
            expect(await screen.findByText('Golf Glove (1 × $15.00)')).toBeInTheDocument();

            await clickEdit(user, row);
            await setQuantity(user, row, SB.quantity, 'Golf Glove', 4);
            await clickSaveChanges(user, row);

            expect(await screen.findByText('Golf Glove (4 × $15.00)')).toBeInTheDocument();
            expect(await screen.findByText('$266.00')).toBeInTheDocument(); // 206 + 15×4
        });
    });

    describe('Family Membership — adults/juniors pricing', () => {
        it('has no Party Size field for Annual Individual Membership, and still confirms normally', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Annual Individual Membership');
            expect(row.querySelector('input[id^="party-"]')).toBeNull();
            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2026-12-02' } });
            await clickConfirm(user, row);
            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
        });

        it('replaces the Party Size field with separate Number of Adults / Number of Juniors inputs for Family Membership', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Family Membership');
            expect(row.querySelector('input[id^="party-"]')).toBeNull();
            expect(within(row).getByRole('spinbutton', { name: `${SB.numberOfAdults} — Family Membership` })).toBeInTheDocument();
            expect(within(row).getByRole('spinbutton', { name: `${SB.numberOfJuniors} — Family Membership` })).toBeInTheDocument();
        });

        it('updates the subtotal immediately as adults/juniors change, priced at (full price / 5) per member', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Family Membership');
            expect(within(row).getByText(`${SB.subtotal}: $2,000.00`)).toBeInTheDocument(); // default 2 adults + 3 juniors

            await setQuantity(user, row, SB.numberOfAdults, 'Family Membership', 1);
            await setQuantity(user, row, SB.numberOfJuniors, 'Family Membership', 0);
            expect(within(row).getByText(`${SB.subtotal}: $400.00`)).toBeInTheDocument(); // (2000/5) × 1
        });

        it('accepts more than the old 2 adults / 3 juniors limits, as long as there is a valid date', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Family Membership');
            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2026-12-02' } });
            await setQuantity(user, row, SB.numberOfAdults, 'Family Membership', 3); // more than the old max of 2
            expect(within(row).getByText(`${SB.subtotal}: $2,400.00`)).toBeInTheDocument(); // (3+3) × 400
            await clickConfirm(user, row);

            expect(within(row).getByText(SB.confirmed)).toBeInTheDocument();
            expect(within(row).queryByText(SB.familyMembersInvalid)).toBeNull();
        });

        it('blocks Confirm and warns when adults/juniors are actually invalid (zero adults), and the invoice/total stay unaffected', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Family Membership');
            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2026-12-02' } });
            await setQuantity(user, row, SB.numberOfAdults, 'Family Membership', 0); // at least one adult is required
            await clickConfirm(user, row);

            expect(within(row).getByText(SB.familyMembersInvalid)).toBeInTheDocument();
            expect(within(row).queryByText(SB.confirmed)).toBeNull();
            expect(screen.getByText('$206.00')).toBeInTheDocument(); // unchanged
        });

        it('submits the selected adults/juniors to api-v2, and the invoice reflects the proportional total', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            mockGolfApi.bookService.mockResolvedValue({
                data: { id: 's1', reference: 'MGS-FAM1', serviceId: 'membership-family', category: 'membership', bookingMode: 'inquiry', name: 'Family Membership', leadName: 'Pat Golfer', contactEmail: 'pat@example.com', courseId: 'fuji', currency: 'USD', unitPrice: 2000, total: 1200, adults: 1, juniors: 2, status: 'confirmed', createdAt: new Date().toISOString() },
                status: 201,
            });
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Family Membership');
            fireEvent.change(row.querySelector('input[type="date"]')!, { target: { value: '2026-12-02' } });
            await setQuantity(user, row, SB.numberOfAdults, 'Family Membership', 1);
            await setQuantity(user, row, SB.numberOfJuniors, 'Family Membership', 2);
            await clickConfirm(user, row);

            expect(await screen.findByText('Family Membership (1 adult, 2 juniors)')).toBeInTheDocument();
            expect(await screen.findByText('$1,406.00')).toBeInTheDocument(); // 206 + (2000/5)×3 = 206 + 1200

            await proceed(user);
            await waitFor(() => expect(mockGolfApi.bookService).toHaveBeenCalledWith('membership-family', expect.objectContaining({ adults: 1, juniors: 2 })));
        });
    });

    it('does not fold a different-currency services total into the Final total, and says so', async () => {
        // The default fixture quote is KRW; the services catalog is always USD.
        const user = userEvent.setup();
        renderWithIntl(view());
        await screen.findByText('₩204,124');

        await addAndConfirm(user, 'Golf Glove');
        expect(screen.getByText('₩204,124')).toBeInTheDocument(); // unchanged — currencies don't mix
        expect(await screen.findByText(SB.summaryCaptionDifferentCurrency)).toBeInTheDocument();
    });

    describe('Pay now vs. the estimated booking total', () => {
        it('labels the real charge "Pay now" and shows a separate, smaller estimated total once a same-currency service is added', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            await addAndConfirm(user, 'Golf Glove'); // $15, same USD as the tee time — combinable

            // "Pay now" is the tee time's own charge alone, never the combined figure.
            const payNowRow = screen.getByText(B.payNow).closest('div')!;
            expect(within(payNowRow).getByText('$206.00')).toBeInTheDocument();

            // The combined figure is shown too, but smaller and under its own, different label —
            // never as "Total"/"Pay now", so it can never be mistaken for what the card is charged.
            const estimateRow = screen.getByText(B.estimatedBookingTotal).closest('div')!;
            expect(within(estimateRow).getByText('$221.00')).toBeInTheDocument(); // 206 + 15

            // And the explanation is on screen, not just implied by the two labels.
            expect(screen.getByText(SB.summaryCaption)).toBeInTheDocument();
        });

        it('keeps the plain "Total" label, with no estimated-total row, when no service is selected', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            renderWithIntl(view());
            await screen.findByText('$206.00');

            expect(screen.getByText(B.total)).toBeInTheDocument();
            expect(screen.queryByText(B.payNow)).toBeNull();
            expect(screen.queryByText(B.estimatedBookingTotal)).toBeNull();
        });

        it('charges the card exactly the "Pay now" figure, never the estimated booking total', async () => {
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            api.startGolfBooking.mockResolvedValue(started({ currency: 'USD', greenFee: 200, serviceFee: 6, total: 206 }));
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            await addAndConfirm(user, 'Golf Glove'); // adds $15 to the estimate, never to the charge
            await proceed(user);

            expect(await screen.findByRole('button', { name: 'Request this tee time · $206.00' })).toBeInTheDocument();
        });
    });

    it('submits only confirmed services at hold time, with their own quantity, and the responses show the same figures as the summary', async () => {
        api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
        api.startGolfBooking.mockResolvedValue(started({ currency: 'USD', greenFee: 200, serviceFee: 6, total: 206 }));
        mockGolfApi.bookService.mockImplementation(async (serviceId: string, body: { quantity?: number }) => {
            if (serviceId === 'equip-glove') {
                return { data: { id: 's1', reference: 'MGS-GLOVE1', serviceId, category: 'equipment', bookingMode: 'product', name: 'Golf Glove', leadName: 'Pat Golfer', contactEmail: 'pat@example.com', courseId: 'fuji', currency: 'USD', unitPrice: 15, total: 15 * (body.quantity ?? 1), status: 'confirmed', createdAt: new Date().toISOString() }, status: 201 };
            }
            return { data: { id: 's2', reference: 'MGS-MEDAL1', serviceId, category: 'tournament', bookingMode: 'inquiry', name: 'Monthly Medal Competition', leadName: 'Pat Golfer', contactEmail: 'pat@example.com', courseId: 'fuji', currency: 'USD', unitPrice: 25, total: 25 * (body.quantity ?? 1), status: 'confirmed', createdAt: new Date().toISOString() }, status: 201 };
        });
        const user = userEvent.setup();
        renderWithIntl(view());
        await screen.findByText('$206.00');

        const gloveRow = await addAndConfirm(user, 'Golf Glove');
        await clickEdit(user, gloveRow);
        await setQuantity(user, gloveRow, SB.quantity, 'Golf Glove', 2);
        await clickSaveChanges(user, gloveRow);
        await addAndConfirm(user, 'Monthly Medal Competition');
        // Opened but never confirmed — must not be submitted at all.
        await openService(user, 'Family Membership');
        await screen.findByText('$261.00'); // 206 + 30 + 25

        await proceed(user);

        await waitFor(() => expect(mockGolfApi.bookService).toHaveBeenCalledWith('equip-glove', expect.objectContaining({
            leadName: 'Pat Golfer', contactEmail: 'pat@example.com', courseId: 'fuji', quantity: 2,
        })));
        expect(mockGolfApi.bookService).toHaveBeenCalledWith('tournament-monthly-medal', expect.objectContaining({ quantity: 1 }));
        expect(mockGolfApi.bookService).not.toHaveBeenCalledWith('membership-family', expect.anything()); // never confirmed
        expect(mockGolfApi.bookService).toHaveBeenCalledTimes(2);
        expect(await screen.findByText('MGS-GLOVE1')).toBeInTheDocument();
        expect(screen.getByText('MGS-MEDAL1')).toBeInTheDocument();
        // The responses' own totals (which the mock API computed) agree with what the summary showed.
        expect(screen.getByText('$30.00')).toBeInTheDocument();
        expect(screen.getByText('$25.00')).toBeInTheDocument();
    });

    it('never submits the same selection twice for one hold', async () => {
        api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
        mockGolfApi.bookService.mockResolvedValue({
            data: { id: 's1', reference: 'MGS-GLOVE1', serviceId: 'equip-glove', category: 'equipment', bookingMode: 'product', name: 'Golf Glove', leadName: 'Pat Golfer', contactEmail: 'pat@example.com', courseId: 'fuji', currency: 'USD', unitPrice: 15, total: 15, status: 'confirmed', createdAt: new Date().toISOString() },
            status: 201,
        });
        const user = userEvent.setup();
        renderWithIntl(view());
        await screen.findByText('$206.00');
        await addAndConfirm(user, 'Golf Glove');
        await proceed(user);
        await waitFor(() => expect(mockGolfApi.bookService).toHaveBeenCalledTimes(1));
        expect(mockGolfApi.bookService).toHaveBeenCalledTimes(1);
    });

    it('does not render the picker once a hold is taken, and shows what was submitted instead', async () => {
        api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
        mockGolfApi.bookService.mockResolvedValue({
            data: { id: 's1', reference: 'MGS-GLOVE1', serviceId: 'equip-glove', category: 'equipment', bookingMode: 'product', name: 'Golf Glove', leadName: 'Pat Golfer', contactEmail: 'pat@example.com', courseId: 'fuji', currency: 'USD', unitPrice: 15, total: 15, status: 'confirmed', createdAt: new Date().toISOString() },
            status: 201,
        });
        const user = userEvent.setup();
        renderWithIntl(view());
        await screen.findByText('$206.00');
        await addAndConfirm(user, 'Golf Glove');
        await proceed(user);
        await screen.findByTestId('payment-element');

        expect(screen.queryByRole('button', { name: SB.remove })).toBeNull();
        expect(screen.getByRole('heading', { name: SB.heading })).toBeInTheDocument();
        expect(await screen.findByText('MGS-GLOVE1')).toBeInTheDocument();
    });

    it('renders nothing when the catalog is empty', async () => {
        mockGolfApi.listServices.mockResolvedValue({ data: { services: [], total: 0 }, status: 200 });
        renderWithIntl(view());
        await screen.findByText('₩204,124');
        expect(screen.queryByRole('heading', { name: SB.heading })).toBeNull();
    });

    it('shows the exact same catalog across three different real courses, and carries each course\'s own slug through as courseId', async () => {
        mockGolfApi.bookService.mockResolvedValue({
            data: { id: 's1', reference: 'MGS-ABC123', serviceId: 'equip-glove', category: 'equipment', bookingMode: 'product', name: 'Golf Glove', leadName: 'Pat Golfer', contactEmail: 'pat@example.com', currency: 'USD', unitPrice: 15, total: 15, status: 'confirmed', createdAt: new Date().toISOString() },
            status: 201,
        });
        for (const course of [
            { slug: 'fuji', name: 'Fuji Lakeside' },
            { slug: 'coral-bay-links', name: 'Coral Bay Links' },
            { slug: 'highland-pines', name: 'Highland Pines' },
        ]) {
            mockGolfApi.bookService.mockClear();
            api.fetchTeeTimeQuote.mockImplementation(async () => ({ ...quoteUSD, course: { ...quoteUSD.course, slug: course.slug, name: course.name } }));

            const user = userEvent.setup();
            const { unmount } = renderWithIntl(<GolfBookView slug={course.slug} teeTimeId={TEE} players={2} />);
            await screen.findByRole('heading', { name: SB.heading });
            for (const name of SERVICES.map((s) => s.name)) expect(screen.getByText(name)).toBeInTheDocument();

            await addAndConfirm(user, 'Golf Glove');
            await proceed(user);
            await waitFor(() => expect(mockGolfApi.bookService).toHaveBeenCalledWith('equip-glove', expect.objectContaining({ courseId: course.slug })));

            unmount();
        }
    });

    describe('display currency', () => {
        // One converted catalog per currency, as api-v2's /services?currency= would actually
        // answer — this is a UI-wiring test; the conversion math itself is covered at the
        // pricing-lib and api-v2 level.
        const CONVERTED: Record<string, { rate: number; glove: number; medal: number }> = {
            USD: { rate: 1,       glove: 15,     medal: 25 },
            CNY: { rate: 0.14,    glove: 107.14, medal: 178.57 },
            PHP: { rate: 0.0175,  glove: 857.14, medal: 1428.57 },
            KRW: { rate: 0.00075, glove: 20000,  medal: 33333 },
            JPY: { rate: 0.0067,  glove: 2239,   medal: 3731 },
        };
        const QUOTE_TOTAL: Record<string, number> = { USD: 206, CNY: 1379.82, PHP: 11771.43, KRW: 274667, JPY: 30746 };

        function servicesFor(currency: string) {
            if (currency === 'USD') return SERVICES;
            const c = CONVERTED[currency];
            return SERVICES.map((s) => (s.price == null ? { ...s, currency } : {
                ...s, currency,
                price: s.id === 'equip-glove' ? c.glove : s.id === 'tournament-monthly-medal' ? c.medal : Math.round((s.price / c.rate) * 100) / 100,
            }));
        }

        it.each([['USD'], ['CNY'], ['PHP'], ['KRW'], ['JPY']])('fetches the catalog already converted into %s, and folds a confirmed service into one Final total', async (currency) => {
            mockGolfApi.listServices.mockImplementation(async (opts?: { currency?: string }) =>
                ({ data: { services: servicesFor(opts?.currency ?? 'USD'), total: SERVICES.length, requestedCurrency: opts?.currency }, status: 200 }));
            api.fetchTeeTimeQuote.mockImplementation(async () => ({ ...quoteUSD, currency, total: QUOTE_TOTAL[currency] }));
            const user = userEvent.setup();
            renderWithIntl(<GolfBookView slug="fuji" teeTimeId={TEE} players={2} />);

            await waitFor(() => expect(mockGolfApi.listServices).toHaveBeenCalledWith({ currency }));
            await addAndConfirm(user, 'Golf Glove');

            const expectedTotal = Math.round((QUOTE_TOTAL[currency] + CONVERTED[currency].glove) * 100) / 100;
            const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(expectedTotal);
            expect(await screen.findByText(formatted)).toBeInTheDocument();
            // Never shown as the old "priced in USD, excluded" message — currencies now match.
            expect(screen.queryByText(SB.summaryCaptionDifferentCurrency)).toBeNull();
        });

        it('re-fetches the catalog in the new currency when the header currency changes, preserves a confirmed selection\'s quantity, and books nothing new', async () => {
            mockGolfApi.listServices.mockImplementation(async (opts?: { currency?: string }) =>
                ({ data: { services: servicesFor(opts?.currency ?? 'USD'), total: SERVICES.length, requestedCurrency: opts?.currency }, status: 200 }));
            api.fetchTeeTimeQuote.mockImplementation(async () => quoteUSD);
            const user = userEvent.setup();
            renderWithIntl(view());
            await screen.findByText('$206.00');

            const row = await openService(user, 'Golf Glove');
            await setQuantity(user, row, SB.quantity, 'Golf Glove', 2);
            await clickConfirm(user, row);
            await screen.findByText('$236.00'); // 206 + 15×2

            api.fetchTeeTimeQuote.mockImplementation(async () => ({ ...quoteUSD, currency: 'CNY', total: QUOTE_TOTAL.CNY }));
            act(() => useSearchStore.setState({ userCurrency: 'CNY' }));

            await waitFor(() => expect(mockGolfApi.listServices).toHaveBeenLastCalledWith({ currency: 'CNY' }));
            // The quantity confirmed before the switch is still there — selections survive a currency change.
            await waitFor(() => expect(within(row).getByText(SB.confirmed)).toBeInTheDocument());
            await clickEdit(user, row);
            expect(within(row).getByRole('spinbutton', { name: `${SB.quantity} — Golf Glove` })).toHaveValue(2);
            expect(mockGolfApi.bookService).not.toHaveBeenCalled(); // switching currency never books anything
        });

        it('excludes a quote-based event from the Final total no matter the currency', async () => {
            mockGolfApi.listServices.mockImplementation(async (opts?: { currency?: string }) =>
                ({ data: { services: servicesFor(opts?.currency ?? 'USD'), total: SERVICES.length, requestedCurrency: opts?.currency }, status: 200 }));
            api.fetchTeeTimeQuote.mockImplementation(async () => ({ ...quoteUSD, currency: 'JPY', total: QUOTE_TOTAL.JPY }));
            const user = userEvent.setup();
            renderWithIntl(<GolfBookView slug="fuji" teeTimeId={TEE} players={2} />);
            await waitFor(() => expect(mockGolfApi.listServices).toHaveBeenCalledWith({ currency: 'JPY' }));

            const row = await addAndConfirm(user, 'Corporate Golf Outing');
            const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'JPY' }).format(QUOTE_TOTAL.JPY);
            expect(screen.getByText(formatted)).toBeInTheDocument(); // unchanged — nothing payable added
            expect(within(row).getByText(SB.quotePending)).toBeInTheDocument();
        });

        it('falls back to USD and warns when live rates are unavailable for the requested currency, rather than mixing currencies', async () => {
            mockGolfApi.listServices.mockResolvedValue({ data: { services: SERVICES, total: SERVICES.length, requestedCurrency: 'CNY', rateUnavailable: true }, status: 200 });
            api.fetchTeeTimeQuote.mockImplementation(async () => ({ ...quoteUSD, currency: 'CNY', total: QUOTE_TOTAL.CNY }));
            const user = userEvent.setup();
            renderWithIntl(<GolfBookView slug="fuji" teeTimeId={TEE} players={2} />);

            expect(await screen.findByText(SB.rateUnavailableNote)).toBeInTheDocument();
            await addAndConfirm(user, 'Golf Glove');
            // Still USD (the canonical, unconverted price) since the catalog could not be converted.
            expect(screen.getByText(SB.summaryCaptionDifferentCurrency)).toBeInTheDocument();
        });
    });
});
