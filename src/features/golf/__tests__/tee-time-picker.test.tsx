import React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useSearchStore } from '@/shared/stores/search.store';
import type { GolfCourse, TeeTimeDay, TeeTimeQuote } from '@/features/golf/types';

const api = vi.hoisted(() => ({ fetchTeeTimes: vi.fn(), fetchTeeTimeQuote: vi.fn() }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);
vi.mock('@/i18n/navigation', () => ({
    useRouter: () => nav,
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));

import { TeeTimePicker } from '@/features/golf/components/tee-time-picker';

/**
 * The course page's booking band: a row of days, a party size, the open times in one sideways row
 * priced all-in per player in the visitor's currency, and the way to book the one picked.
 */

const course: GolfCourse = {
    id: 'c1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 85, currency: 'USD', imageUrls: [], amenities: [],
    status: 'published', createdAt: '', updatedAt: '', timezone: 'Asia/Manila', bookingWindowDays: 60, freeCancelHours: 48,
    scheduleCount: 1, bookable: true,
};

const day = (over: Partial<TeeTimeDay> = {}): TeeTimeDay => ({
    timezone: 'Asia/Manila', date: '2026-11-15', firstDate: '2026-11-05', lastDate: '2026-11-30', players: 2,
    teeTimes: [
        { id: 't1', startsAt: '2026-11-14T23:30:00Z', localTime: '07:30', spotsLeft: 3, allInPerPlayer: 121243, currency: 'KRW' },
        { id: 't2', startsAt: '2026-11-15T00:00:00Z', localTime: '08:00', spotsLeft: 1, allInPerPlayer: 121243, currency: 'KRW' },
        { id: 't3', startsAt: '2026-11-15T00:30:00Z', localTime: '08:30', spotsLeft: 4, allInPerPlayer: null, currency: null },
    ],
    ...over,
});

const quote: TeeTimeQuote = {
    teeTimeId: 't1', course: { slug: 'wack-wack', name: 'Wack Wack', city: 'Mandaluyong', country: 'Philippines', imageUrl: null },
    startsAt: '2026-11-14T23:30:00Z', timezone: 'Asia/Manila', players: 2, spotsLeft: 3,
    currency: 'KRW', greenFee: 240000, extras: [], extrasTotal: 0, extraOffers: [], serviceFee: 2487, total: 242487,
    freeCancelUntil: '2026-11-13T00:00:00Z',
};

beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ userCurrency: 'KRW' });
    api.fetchTeeTimes.mockImplementation(async (_slug: string, opts: { date?: string; players: number; currency?: string }) =>
        day({ date: opts.date ?? '2026-11-15', players: opts.players }));
    api.fetchTeeTimeQuote.mockResolvedValue(quote);
});

const time = (label: string) => screen.findByRole('button', { name: new RegExp(`^${label}`) });

describe('TeeTimePicker', () => {
    it("asks for the visitor's currency and two players, and shows each time with its spots and price", async () => {
        renderWithIntl(<TeeTimePicker course={course} />);
        const t1 = await time('7:30');
        expect(within(t1).getByText('3 left')).toBeInTheDocument();
        expect(within(t1).getByText('₩121,243')).toBeInTheDocument();
        expect(api.fetchTeeTimes).toHaveBeenCalledWith('wack-wack', { date: undefined, players: 2, currency: 'KRW' });
        expect(screen.getByText(/All-in price per player for 2 players/)).toBeInTheDocument();
    });

    it('asks again for a different party size, on the same day', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await time('7:30');
        await user.click(screen.getByRole('button', { name: '3' }));
        await waitFor(() => expect(api.fetchTeeTimes).toHaveBeenLastCalledWith('wack-wack', { date: '2026-11-15', players: 3, currency: 'KRW' }));
    });

    it('follows the header currency and keeps the picked time', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await time('7:30'));
        act(() => useSearchStore.setState({ userCurrency: 'USD' }));
        await waitFor(() => expect(api.fetchTeeTimes).toHaveBeenLastCalledWith('wack-wack', { date: '2026-11-15', players: 2, currency: 'USD' }));
        expect(await time('7:30')).toHaveAttribute('aria-pressed', 'true');
        await waitFor(() => expect(api.fetchTeeTimeQuote).toHaveBeenLastCalledWith('t1', { players: 2, currency: 'USD' }));
    });

    it('shows the exact total from the quote, and books the picked time for that party', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        expect(await screen.findByText(en.golf.teeTimes.pickHint)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: en.golf.teeTimes.book })).toBeNull();

        await user.click(await time('7:30'));
        expect(api.fetchTeeTimeQuote).toHaveBeenCalledWith('t1', { players: 2, currency: 'KRW' });
        // The quote's own figure, not the per-player price doubled (₩242,486).
        expect(await screen.findByText('₩242,487')).toBeInTheDocument();
        expect(screen.getByText('Sun 15 Nov · 7:30 AM · 2 players')).toBeInTheDocument();
        expect(screen.getByText(en.golf.teeTimes.chargedAfter)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: en.golf.teeTimes.book }))
            .toHaveAttribute('href', '/golf/wack-wack/book?teeTime=t1&players=2&date=2026-11-15');
    });

    it('holds the Book link back until the total is known', async () => {
        api.fetchTeeTimeQuote.mockReturnValueOnce(new Promise(() => undefined));
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await time('7:30'));
        expect(screen.getByRole('link', { name: en.golf.teeTimes.book })).toHaveAttribute('aria-disabled', 'true');
    });

    it('says so when the picked time has just gone, and offers no way to book it', async () => {
        api.fetchTeeTimeQuote.mockRejectedValueOnce(Object.assign(new Error('gone'), { status: 409 }));
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await time('7:30'));
        expect(await screen.findByText(en.golf.teeTimes.justGone)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: en.golf.teeTimes.book })).toBeNull();
    });

    it('does not offer a time with no price, or too few spots for the party', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        expect(await time('8:30')).toBeDisabled();
        // One spot left and a party of two.
        expect(await time('8:00')).toBeDisabled();
        await user.click(screen.getByRole('button', { name: '1' }));
        await waitFor(async () => expect(await time('8:00')).toBeEnabled());
    });

    it('lets go of a picked time the new party no longer fits', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await time('7:30'));
        await user.click(screen.getByRole('button', { name: '4' }));
        await waitFor(() => expect(api.fetchTeeTimes).toHaveBeenLastCalledWith('wack-wack', { date: '2026-11-15', players: 4, currency: 'KRW' }));
        expect(await screen.findByText(en.golf.teeTimes.pickHint)).toBeInTheDocument();
    });

    it('keeps the picked day, party and time in the address', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await time('7:30'));
        await waitFor(() => expect(nav.replace).toHaveBeenLastCalledWith(
            '/golf/wack-wack?date=2026-11-15&players=2&time=t1', { scroll: false }));
    });

    it('starts from the day, party and time it is given', async () => {
        renderWithIntl(<TeeTimePicker course={course} initial={{ date: '2026-11-20', players: 2, time: 't1' }} />);
        expect(await time('7:30')).toHaveAttribute('aria-pressed', 'true');
        expect(api.fetchTeeTimes).toHaveBeenCalledWith('wack-wack', { date: '2026-11-20', players: 2, currency: 'KRW' });
    });

    it('lays out every day in range as a row to pick from, and nothing outside it', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await time('7:30');
        expect(screen.getByRole('button', { name: '15 November 2026' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: '5 November 2026' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '30 November 2026' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '4 November 2026' })).toBeNull();
        expect(screen.queryByRole('button', { name: '1 December 2026' })).toBeNull();

        await user.click(screen.getByRole('button', { name: '20 November 2026' }));
        await waitFor(() => expect(api.fetchTeeTimes).toHaveBeenLastCalledWith('wack-wack', { date: '2026-11-20', players: 2, currency: 'KRW' }));
    });

    it('lets go of the picked time when the day changes', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await time('7:30'));
        await user.click(screen.getByRole('button', { name: '20 November 2026' }));
        expect(await screen.findByText(en.golf.teeTimes.pickHint)).toBeInTheDocument();
    });

    it('says so when a day has nothing left', async () => {
        api.fetchTeeTimes.mockResolvedValueOnce(day({ teeTimes: [] }));
        renderWithIntl(<TeeTimePicker course={course} />);
        expect(await screen.findByText(en.golf.teeTimes.none)).toBeInTheDocument();
    });

    it('offers another try when tee times fail to load', async () => {
        const user = userEvent.setup();
        api.fetchTeeTimes.mockRejectedValueOnce(new Error('down'));
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await screen.findByRole('button', { name: en.golf.retry }));
        expect(await time('7:30')).toBeInTheDocument();
    });
});
