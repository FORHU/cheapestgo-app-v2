import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithIntl, withIntl } from '@/shared/testing/renderWithIntl';
import { formatCurrency } from '@/shared/lib/format';
import en from '@/locales/en.json';
import { useSearchStore } from '@/shared/stores/search.store';
import type { GolfCourse } from '@/features/golf/types';

const push = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
    useRouter: () => ({ push }),
}));
const api = vi.hoisted(() => ({ fetchGolfCatalogue: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);

import { GolfSentence, lastBookableDay } from '@/features/golf/components/golf-sentence';
import { GOLF_FACE, lastGolfSearch } from '@/features/golf/lib/last-search';

const course = (over: Partial<GolfCourse> = {}): GolfCourse => ({
    id: '1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 120000, currency: 'KRW', imageUrls: [],
    amenities: [], status: 'published', createdAt: '', updatedAt: '', timezone: 'Asia/Manila', bookingWindowDays: 60, freeCancelHours: 48,
    scheduleCount: 1, bookable: true, ...over,
});
const sky = course({ id: '2', slug: 'sky72', name: 'Sky72', city: 'Incheon', country: 'South Korea', greenFeeFrom: null, bookingWindowDays: 5 });

const G = en.search.golf;

beforeEach(() => {
    push.mockReset();
    api.fetchGolfCatalogue.mockReset();
    useSearchStore.setState({ userCurrency: 'KRW' });
    // A fixed today, so the calendar's days and the booking window are known. Only the clock: the
    // sentence's own timers (the hop to the next panel) still run.
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 10, 12));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('GolfSentence', () => {
    it('reads as a sentence with its blanks open until something is picked', () => {
        renderWithIntl(<GolfSentence courses={[course()]} />);
        expect(screen.getByText('the course')).toBeInTheDocument();
        expect(screen.getByText('the first open day')).toBeInTheDocument();
        expect(screen.getByText('2 players')).toBeInTheDocument();
    });

    it('will not go anywhere without a course: it shakes and opens the course list', async () => {
        renderWithIntl(<GolfSentence courses={[course()]} />);
        await userEvent.setup().click(screen.getByRole('button', { name: en.landing.search.go }));
        expect(screen.getByRole('textbox', { name: G.findCourse })).toBeInTheDocument();
        expect(push).not.toHaveBeenCalled();
    });

    it('opens a picked course with the party, and lets the course choose its first day', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfSentence courses={[course(), sky]} />);

        await user.click(screen.getByText('the course'));
        const row = screen.getByRole('button', { name: /Wack Wack/ });
        expect(row).toHaveTextContent(`from ${formatCurrency(120000, 'KRW')}`);
        await user.click(row);

        expect(screen.getByText('Wack Wack')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: en.landing.search.go }));
        expect(push).toHaveBeenCalledWith('/golf/wack-wack?players=2');
    });

    it('is the search the course page goes back to', async () => {
        sessionStorage.clear();
        renderWithIntl(<GolfSentence courses={[course()]} coursePick={{ slug: 'wack-wack' }} />);
        expect(lastGolfSearch()).toBe('/golf');

        await userEvent.setup().click(screen.getByRole('button', { name: en.landing.search.go }));
        expect(lastGolfSearch()).toBe(GOLF_FACE);
    });

    it('puts a picked day and party size in the address, as the calendar shows the day', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfSentence courses={[course()]} coursePick={{ slug: 'wack-wack' }} />);

        await user.click(screen.getByText('the first open day'));
        await user.click(screen.getByText('20'));
        // Picking a day moves on to the party size by itself.
        await user.click(await screen.findByRole('button', { name: G.more }));
        expect(screen.getByText('3 players')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: en.landing.search.go }));
        expect(push).toHaveBeenCalledWith('/golf/wack-wack?date=2026-11-20&players=3');
    });

    it('keeps the party to what the course page can price: one to four', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfSentence courses={[course()]} />);
        await user.click(screen.getByText('2 players'));
        await user.click(screen.getByRole('button', { name: G.fewer }));
        expect(screen.getByRole('button', { name: G.fewer })).toBeDisabled();
        for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: G.more }));
        expect(screen.getByText('4 players')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: G.more })).toBeDisabled();
    });

    it('stops the calendar at the last day the course lists', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfSentence courses={[sky]} coursePick={{ slug: 'sky72' }} />);
        await user.click(screen.getByText('the first open day'));
        // Today is the 10th and the window five days: the 14th is the last day it lists.
        expect(screen.getByText('14')).not.toHaveAttribute('aria-disabled');
        expect(screen.getByText('15')).toHaveAttribute('aria-disabled', 'true');
    });

    it('lets a picked day go when the course changes to one that does not reach it', async () => {
        const user = userEvent.setup();
        const { rerender } = renderWithIntl(<GolfSentence courses={[course(), sky]} coursePick={{ slug: 'wack-wack' }} />);
        await user.click(screen.getByText('the first open day'));
        await user.click(screen.getByText('20'));
        expect(screen.getByText('Nov 20')).toBeInTheDocument();

        rerender(withIntl(<GolfSentence courses={[course(), sky]} coursePick={{ slug: 'sky72' }} />));
        expect(await screen.findByText('the first open day')).toBeInTheDocument();
    });

    it('takes a course picked outside it, and says which course it holds', async () => {
        const onCourseChange = vi.fn();
        renderWithIntl(<GolfSentence courses={[course()]} coursePick={{ slug: 'wack-wack' }} onCourseChange={onCourseChange} />);
        expect(screen.getByText('Wack Wack')).toBeInTheDocument();
        await waitFor(() => expect(onCourseChange).toHaveBeenLastCalledWith('wack-wack'));
    });

    it('narrows the list as the visitor types', async () => {
        const user = userEvent.setup();
        renderWithIntl(<GolfSentence courses={[course(), sky]} />);
        await user.click(screen.getByText('the course'));
        await user.type(screen.getByRole('textbox', { name: G.findCourse }), 'korea');
        expect(screen.getByRole('button', { name: /Sky72/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Wack Wack/ })).toBeNull();

        await user.clear(screen.getByRole('textbox', { name: G.findCourse }));
        await user.type(screen.getByRole('textbox', { name: G.findCourse }), 'zzz');
        expect(screen.getByText('No course matches “zzz”.')).toBeInTheDocument();
    });

    it('says when the courses are still coming, and when there are none, and always offers the catalogue', async () => {
        const user = userEvent.setup();
        const { rerender } = renderWithIntl(<GolfSentence courses={null} />);
        await user.click(screen.getByText('the course'));
        expect(screen.getByText(G.loading)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: G.allCourses })).toHaveAttribute('href', '/golf');

        rerender(withIntl(<GolfSentence courses={[]} />));
        expect(screen.getByText(G.none)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: G.allCourses })).toBeInTheDocument();
    });

    it('asks for the catalogue itself, in the visitor\'s currency, when it was not handed one', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [course()], countries: [] });
        const user = userEvent.setup();
        renderWithIntl(<GolfSentence />);
        await waitFor(() => expect(api.fetchGolfCatalogue).toHaveBeenCalledWith({ currency: 'KRW' }));
        await user.click(screen.getByText('the course'));
        expect(await screen.findByRole('button', { name: /Wack Wack/ })).toBeInTheDocument();
    });
});

describe('lastBookableDay', () => {
    it('is today and the window\'s other days after it, as api-v2 lists them', () => {
        const last = lastBookableDay(course({ bookingWindowDays: 60 }), new Date(2026, 10, 5, 9));
        expect([last.getFullYear(), last.getMonth(), last.getDate()]).toEqual([2027, 0, 3]);
    });
});
