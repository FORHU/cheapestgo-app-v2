import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, withIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useSearchStore } from '@/shared/stores/search.store';
import type { GolfCourse } from '@/features/golf/types';

const api = vi.hoisted(() => ({ fetchGolfCatalogue: vi.fn(), fetchGolfCourse: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);
// The landing navbar is tested where it lives; here it only has to be there.
vi.mock('@/features/landing/components/landing-header', () => ({ LandingHeader: () => <header data-testid="landing-header" /> }));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
    useRouter: () => ({ push: vi.fn() }),
}));

import { GolfListView } from '@/features/golf/components/golf-list-view';
import { lastGolfSearch } from '@/features/golf/lib/last-search';

const course =(over: Partial<GolfCourse> = {}): GolfCourse => ({
    id: '1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: null,
    description: '', holes: 36, par: 72, greenFeeFrom: 120000, currency: 'KRW', imageUrls: ['https://img.example/a.jpg'],
    amenities: [], status: 'published', createdAt: '', updatedAt: '', timezone: 'Asia/Manila', bookingWindowDays: 60, freeCancelHours: 48, scheduleCount: 1, bookable: true, ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ userCurrency: 'KRW' });
});

describe('GolfListView', () => {
    it("asks in the viewer's currency and shows each course with its from-fee", async () => {
        api.fetchGolfCatalogue.mockResolvedValue({
            courses: [course(), course({ id: '2', slug: 'sky72', name: 'Sky72', greenFeeFrom: null })],
            countries: ['Philippines'],
        });
        renderWithIntl(<GolfListView />);

        const wack = await screen.findByRole('link', { name: /Wack Wack/ });
        expect(wack).toHaveAttribute('href', '/golf/wack-wack');
        expect(within(wack).getByText('Green fees from ₩120,000')).toBeInTheDocument();
        expect(within(screen.getByRole('link', { name: /Sky72/ })).queryByText(/Green fees from/)).toBeNull();
        expect(api.fetchGolfCatalogue).toHaveBeenCalledWith({ country: undefined, currency: 'KRW' });
    });

    it('stands on the results ground under the landing navbar, and counts the courses', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [course(), course({ id: '2', slug: 'sky72', name: 'Sky72' })], countries: [] });
        renderWithIntl(<GolfListView />);
        expect(await screen.findByText('2 courses')).toBeInTheDocument();
        expect(screen.getByTestId('landing-header')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: en.golf.title })).toBeInTheDocument();
        expect(document.body).toHaveClass('flat-ground');
    });

    it('says which country it is counting', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [course()], countries: ['Japan', 'Philippines'] });
        renderWithIntl(<GolfListView country="Philippines" />);
        expect(await screen.findByText('1 course in Philippines')).toBeInTheDocument();
    });

    it('offers the countries as links once there is more than one', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [course()], countries: ['Japan', 'Philippines'] });
        renderWithIntl(<GolfListView />);
        expect(await screen.findByRole('link', { name: 'Japan' })).toHaveAttribute('href', '/golf?country=Japan');
        expect(screen.getByRole('link', { name: en.golf.allCountries })).toHaveAttribute('href', '/golf');
    });

    it('says so when nothing is published', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [], countries: [] });
        renderWithIntl(<GolfListView />);
        expect(await screen.findByText(en.golf.emptyTitle)).toBeInTheDocument();
    });

    it('says which country is empty, and offers the rest', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [], countries: ['Japan'] });
        renderWithIntl(<GolfListView country="Philippines" />);
        expect(await screen.findByText('No courses in Philippines')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: en.golf.seeAll })).toHaveAttribute('href', '/golf');
        expect(api.fetchGolfCatalogue).toHaveBeenCalledWith({ country: 'Philippines', currency: 'KRW' });
    });

    it('is the search a course page goes back to, with the country it was narrowed to', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [course()], countries: [] });
        const { rerender } = renderWithIntl(<GolfListView country="South Korea" />);
        expect(lastGolfSearch()).toBe('/golf?country=South%20Korea');

        rerender(withIntl(<GolfListView />));
        expect(lastGolfSearch()).toBe('/golf');
        await screen.findByRole('link', { name: /Wack Wack/ });
    });

    it('offers another try when the list fails to load', async () => {
        api.fetchGolfCatalogue
            .mockRejectedValueOnce(new Error('down'))
            .mockResolvedValueOnce({ courses: [course()], countries: [] });
        renderWithIntl(<GolfListView />);
        await userEvent.setup().click(await screen.findByRole('button', { name: en.golf.retry }));
        expect(await screen.findByRole('link', { name: /Wack Wack/ })).toBeInTheDocument();
        expect(api.fetchGolfCatalogue).toHaveBeenCalledTimes(2);
    });
});
