import React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useSearchStore } from '@/shared/stores/search.store';
import { useAuthStore } from '@/shared/auth/store';
import { useSupportWidget } from '@/features/support/lib/supportWidget.store';
import type { GolfCourse, TeeTimeDay } from '@/features/golf/types';

const api = vi.hoisted(() => ({ fetchTeeTimes: vi.fn() }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);
vi.mock('@/i18n/navigation', () => ({
    useRouter: () => nav,
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));

import { TeeTimePicker } from '@/features/golf/components/tee-time-picker';

/**
 * The course page's tee times: a date, a party size, the open times priced all-in per player in the
 * visitor's currency, and a question about the one picked.
 */

const course: GolfCourse = {
    id: 'c1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 85, currency: 'USD', imageUrls: [], amenities: [],
    status: 'published', createdAt: '', updatedAt: '', timezone: 'Asia/Manila', bookingWindowDays: 60,
    scheduleCount: 1, bookable: true,
};

const day = (over: Partial<TeeTimeDay> = {}): TeeTimeDay => ({
    timezone: 'Asia/Manila', date: '2026-11-15', firstDate: '2026-11-05', lastDate: '2027-01-02', players: 2,
    teeTimes: [
        { id: 't1', startsAt: '2026-11-14T23:30:00Z', localTime: '07:30', spotsLeft: 3, allInPerPlayer: 121243, currency: 'KRW' },
        { id: 't2', startsAt: '2026-11-15T00:00:00Z', localTime: '08:00', spotsLeft: 1, allInPerPlayer: null, currency: null },
    ],
    ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ userCurrency: 'KRW' });
    useAuthStore.setState({ user: { id: 'u1' } as never, isLoading: false });
    useSupportWidget.setState({ openRequests: 0, draft: null });
    api.fetchTeeTimes.mockImplementation(async (_slug: string, opts: { date?: string; players: number; currency?: string }) =>
        day({ date: opts.date ?? '2026-11-15', players: opts.players }));
});

const time = (label: string) => screen.findByRole('button', { name: new RegExp(`^${label}`) });

describe('TeeTimePicker', () => {
    it("asks for the visitor's currency and two players, and shows each time with its spots and price", async () => {
        renderWithIntl(<TeeTimePicker course={course} />);
        const t1 = await time('07:30');
        expect(within(t1).getByText('3 left')).toBeInTheDocument();
        expect(within(t1).getByText('₩121,243')).toBeInTheDocument();
        expect(within(await time('08:00')).getByText(en.golf.teeTimes.priceOnRequest)).toBeInTheDocument();
        expect(api.fetchTeeTimes).toHaveBeenCalledWith('wack-wack', { date: undefined, players: 2, currency: 'KRW' });
        expect(screen.getByText(/All-in price per player for 2 players/)).toBeInTheDocument();
    });

    it('asks again for a different party size, on the same day', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await time('07:30');
        await user.click(screen.getByRole('button', { name: '3' }));
        await waitFor(() => expect(api.fetchTeeTimes).toHaveBeenLastCalledWith('wack-wack', { date: '2026-11-15', players: 3, currency: 'KRW' }));
    });

    it('follows the header currency and keeps the picked time', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await time('07:30'));
        act(() => useSearchStore.setState({ userCurrency: 'USD' }));
        await waitFor(() => expect(api.fetchTeeTimes).toHaveBeenLastCalledWith('wack-wack', { date: '2026-11-15', players: 2, currency: 'USD' }));
        expect(await time('07:30')).toHaveAttribute('aria-pressed', 'true');
    });

    it('turns the button into a question about the picked time, with a draft naming it', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        expect(await screen.findByText(en.golf.teeTimes.pickHint)).toBeInTheDocument();
        await user.click(await time('07:30'));
        await user.click(screen.getByRole('button', { name: en.golf.teeTimes.askThis }));
        const { draft } = useSupportWidget.getState();
        expect(draft).toContain('Wack Wack');
        expect(draft).toContain('07:30');
        expect(draft).toContain('Mandaluyong time');
        expect(draft).toContain('2 players');
        expect(draft).toContain('Sun 15 Nov');
    });

    it('keeps the picked day, party and time in the address', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await time('07:30'));
        await waitFor(() => expect(nav.replace).toHaveBeenLastCalledWith(
            '/golf/wack-wack?date=2026-11-15&players=2&time=t1', { scroll: false }));
    });

    it('starts from the day, party and time it is given', async () => {
        renderWithIntl(<TeeTimePicker course={course} initial={{ date: '2026-11-20', players: 4, time: 't1' }} />);
        expect(await time('07:30')).toHaveAttribute('aria-pressed', 'true');
        expect(api.fetchTeeTimes).toHaveBeenCalledWith('wack-wack', { date: '2026-11-20', players: 4, currency: 'KRW' });
    });

    it('lets a day in range be picked, and not one outside it', async () => {
        const user = userEvent.setup();
        renderWithIntl(<TeeTimePicker course={course} />);
        await time('07:30');
        expect(screen.getByRole('button', { name: '4 November 2026' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: '20 November 2026' }));
        await waitFor(() => expect(api.fetchTeeTimes).toHaveBeenLastCalledWith('wack-wack', { date: '2026-11-20', players: 2, currency: 'KRW' }));
    });

    it('says so when a day has nothing left, and offers another try when it fails', async () => {
        api.fetchTeeTimes.mockResolvedValueOnce(day({ teeTimes: [] }));
        renderWithIntl(<TeeTimePicker course={course} />);
        expect(await screen.findByText(en.golf.teeTimes.none)).toBeInTheDocument();
    });

    it('offers another try when tee times fail to load', async () => {
        const user = userEvent.setup();
        api.fetchTeeTimes.mockRejectedValueOnce(new Error('down'));
        renderWithIntl(<TeeTimePicker course={course} />);
        await user.click(await screen.findByRole('button', { name: en.golf.retry }));
        expect(await time('07:30')).toBeInTheDocument();
    });
});
