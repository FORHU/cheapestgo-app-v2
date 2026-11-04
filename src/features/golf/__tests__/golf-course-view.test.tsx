import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import en from '@/locales/en.json';
import { useSearchStore } from '@/shared/stores/search.store';
import { useAuthStore } from '@/shared/auth/store';
import type { GolfCourse } from '@/features/golf/types';

const api = vi.hoisted(() => ({ fetchGolfCatalogue: vi.fn(), fetchGolfCourse: vi.fn(), fetchTeeTimes: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);
vi.mock('@/shared/components/header', () => ({ Header: () => null }));
vi.mock('@/shared/components/footer', () => ({ Footer: () => null }));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { GolfCourseView } from '@/features/golf/components/golf-course-view';

const course = (over: Partial<GolfCourse> = {}): GolfCourse => ({
    id: '1', slug: 'wack-wack', name: 'Wack Wack', country: 'Philippines', city: 'Mandaluyong', address: '1 Golf Rd',
    description: 'First paragraph.\n\nSecond paragraph.', holes: 36, par: 72, greenFeeFrom: 120000, currency: 'KRW',
    imageUrls: ['https://img.example/a.jpg', 'https://img.example/b.jpg'], amenities: ['caddie', 'night_golf'],
    status: 'published', createdAt: '', updatedAt: '', timezone: null, bookingWindowDays: 60, scheduleCount: 0, bookable: false, ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.setState({ userCurrency: 'KRW' });
    useAuthStore.setState({ user: null, isLoading: false });
});

describe('GolfCourseView', () => {
    it('lays out the course: facts, fee, amenities, paragraphs, address', async () => {
        api.fetchGolfCourse.mockResolvedValue(course());
        renderWithIntl(<GolfCourseView slug="wack-wack" />);

        expect(await screen.findByRole('heading', { level: 1, name: 'Wack Wack' })).toBeInTheDocument();
        expect(screen.getByText('36 holes')).toBeInTheDocument();
        expect(screen.getByText('Par 72')).toBeInTheDocument();
        expect(screen.getByText('₩120,000')).toBeInTheDocument();
        expect(screen.getByText('Caddies')).toBeInTheDocument();
        expect(screen.getByText('Night golf')).toBeInTheDocument();
        expect(screen.getByText('First paragraph.')).toBeInTheDocument();
        expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
        expect(screen.getByText('1 Golf Rd')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: en.golf.askTeeTimes })).toBeInTheDocument();
        expect(api.fetchGolfCourse).toHaveBeenCalledWith('wack-wack', 'KRW');
    });

    it('leaves out what the course does not have', async () => {
        api.fetchGolfCourse.mockResolvedValue(course({ par: null, greenFeeFrom: null, amenities: [], address: null, description: '' }));
        renderWithIntl(<GolfCourseView slug="wack-wack" />);
        await screen.findByRole('heading', { level: 1, name: 'Wack Wack' });
        expect(screen.queryByText(/^Par/)).toBeNull();
        expect(screen.queryByText(en.golf.fromLabel)).toBeNull();
        expect(screen.queryByText(en.golf.amenitiesTitle)).toBeNull();
        expect(screen.queryByText(en.golf.addressTitle)).toBeNull();
    });

    it('switches the large photo from the thumbnails', async () => {
        api.fetchGolfCourse.mockResolvedValue(course());
        renderWithIntl(<GolfCourseView slug="wack-wack" />);
        await userEvent.setup().click(await screen.findByRole('button', { name: 'Photo 2' }));
        expect(screen.getByRole('img', { name: 'Wack Wack' })).toHaveAttribute('src', 'https://img.example/b.jpg');
    });

    it('says the course is not available when there is no such course', async () => {
        api.fetchGolfCourse.mockRejectedValue(Object.assign(new Error('Golf course not found'), { status: 404 }));
        renderWithIntl(<GolfCourseView slug="gone" />);
        expect(await screen.findByText(en.golf.missingTitle)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: en.golf.seeAll })).toHaveAttribute('href', '/golf');
    });

    it('offers another try on any other failure', async () => {
        api.fetchGolfCourse
            .mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 }))
            .mockResolvedValueOnce(course());
        renderWithIntl(<GolfCourseView slug="wack-wack" />);
        await userEvent.setup().click(await screen.findByRole('button', { name: en.golf.retry }));
        expect(await screen.findByRole('heading', { level: 1, name: 'Wack Wack' })).toBeInTheDocument();
    });
});

describe('GolfCourseView with tee times', () => {
    const day = {
        timezone: 'Asia/Manila', date: '2026-11-15', firstDate: '2026-11-05', lastDate: '2027-01-02', players: 2,
        teeTimes: [{ id: 't1', startsAt: '2026-11-14T23:30:00Z', localTime: '07:30', spotsLeft: 3, allInPerPlayer: 121243, currency: 'KRW' }],
    };

    it('shows the tee-time picker in place of the "from" guide, starting from the address', async () => {
        api.fetchGolfCourse.mockResolvedValue(course({ timezone: 'Asia/Manila', scheduleCount: 1, bookable: true }));
        api.fetchTeeTimes.mockResolvedValue(day);
        renderWithIntl(<GolfCourseView slug="wack-wack" initial={{ date: '2026-11-15', players: 3 }} />);
        expect(await screen.findByRole('heading', { name: en.golf.teeTimes.title })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /^07:30/ })).toBeInTheDocument();
        expect(screen.queryByText(en.golf.fromLabel)).toBeNull();
        expect(api.fetchTeeTimes).toHaveBeenCalledWith('wack-wack', { date: '2026-11-15', players: 3, currency: 'KRW' });
    });

    it('keeps the "from" guide and the plain question for a course without tee times', async () => {
        api.fetchGolfCourse.mockResolvedValue(course());
        renderWithIntl(<GolfCourseView slug="wack-wack" />);
        expect(await screen.findByText(en.golf.fromLabel)).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: en.golf.teeTimes.title })).toBeNull();
        expect(api.fetchTeeTimes).not.toHaveBeenCalled();
    });
});
