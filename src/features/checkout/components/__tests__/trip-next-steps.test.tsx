import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl } from '@/shared/testing/renderWithIntl';
import ko from '@/locales/ko.json';
import type { GolfCourse } from '@/features/golf/types';
import { checkoutPalette } from '@/features/checkout/lib/palette';

const api = vi.hoisted(() => ({ fetchGolfCatalogue: vi.fn() }));
vi.mock('@/features/golf/api/golf.api', () => api);
vi.mock('@/i18n/navigation', () => ({
    Link: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));

import { TripNextSteps } from '@/features/checkout/components/trip-next-steps';

const course = (over: Partial<GolfCourse> = {}): GolfCourse => ({
    id: 'c1', slug: 'tokyo-hills', name: 'Tokyo Hills', country: 'Japan', city: 'Tokyo', address: null,
    description: '', holes: 18, par: 72, greenFeeFrom: null, currency: 'JPY', imageUrls: [], amenities: [],
    status: 'published', createdAt: '', updatedAt: '', timezone: 'Asia/Tokyo', bookingWindowDays: 30, freeCancelHours: 48,
    scheduleCount: 1, bookable: true, ...over,
});

const stay = { city: 'Tokyo', checkIn: '2026-12-02', checkOut: '2026-12-08' };
const palette = checkoutPalette('light');
const renderSteps = (opts?: Parameters<typeof renderWithIntl>[1]) =>
    renderWithIntl(<TripNextSteps palette={palette} stay={stay} adults={2} childPassengers={1} />, opts);

beforeEach(() => { vi.clearAllMocks(); });

describe('TripNextSteps', () => {
    it('offers a hotel in the arrival city for the stay, and a tee time at its course', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [course()], countries: ['Japan'] });
        renderSteps();

        expect(screen.getByRole('heading', { name: 'Complete your trip' })).toBeInTheDocument();
        const hotel = screen.getByRole('link', { name: /Book a hotel/ });
        expect(hotel).toHaveTextContent('Stays in Tokyo · Dec 2 – 8');
        expect(hotel).toHaveAttribute('href', '/search?destination=Tokyo&checkIn=2026-12-02&checkOut=2026-12-08&adults=2&children=1&rooms=1');

        const golf = await screen.findByRole('link', { name: /Book a tee time/ });
        expect(golf).toHaveTextContent('Golf courses in Tokyo');
        expect(golf).toHaveAttribute('href', '/golf/tokyo-hills?date=2026-12-03&players=2');
    });

    it('offers every course when none is where the flight lands', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [course({ city: 'Osaka' })], countries: ['Japan'] });
        renderSteps();

        const golf = await screen.findByRole('link', { name: /Book a tee time/ });
        expect(golf).toHaveTextContent('Browse our golf courses');
        expect(golf).toHaveAttribute('href', '/golf');
    });

    it('leaves the hotel on its own when golf cannot be read', async () => {
        api.fetchGolfCatalogue.mockRejectedValue(new Error('down'));
        renderSteps();

        await waitFor(() => expect(api.fetchGolfCatalogue).toHaveBeenCalled());
        expect(screen.getByRole('link', { name: /Book a hotel/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Book a tee time/ })).not.toBeInTheDocument();
    });

    it('speaks the reader\'s language, dates included', async () => {
        api.fetchGolfCatalogue.mockResolvedValue({ courses: [course()], countries: ['Japan'] });
        renderSteps({ locale: 'ko', messages: ko as never });

        expect(screen.getByRole('heading', { name: ko.checkout.flight.receipt.next.title })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: new RegExp(ko.checkout.flight.receipt.next.hotel) })).toHaveTextContent('12월 2일~8일');
        expect(await screen.findByRole('link', { name: new RegExp(ko.checkout.flight.receipt.next.teeTime) })).toBeInTheDocument();
    });
});
