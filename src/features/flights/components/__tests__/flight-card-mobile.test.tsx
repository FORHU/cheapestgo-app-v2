import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { ROUND_TRIP } from './fixtures';

/**
 * The phone's results card: the cheapest or fastest badge by the airline, the bags in one chip,
 * and "Flight details" under the price opening the same panel as the desktop's "Show segments".
 * Which layout shows is CSS (`max-md:` / `md:`), so these assert what is there to show.
 */

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock('@/shared/auth/store', () => ({ useAuthStore: () => ({ user: null }) }));
vi.mock('@/shared/lib/http', () => ({ http: { get: vi.fn(async () => ({})), post: vi.fn(), delete: vi.fn() } }));

import { FlightCard } from '@/features/flights/components/flight-card';
import type { OfferHighlight } from '@/features/flights/lib/filter-offers';

const renderCard = (highlight?: OfferHighlight) =>
    render(
        <NextIntlClientProvider locale="en" messages={en as never}>
            <FlightCard offer={ROUND_TRIP} highlight={highlight} />
        </NextIntlClientProvider>,
    );

describe('the flight card on a phone', () => {
    it('says when it is the fastest, or the cheapest, of the results', () => {
        const { unmount } = renderCard('fastest');
        expect(screen.getByText('Fastest')).toBeInTheDocument();
        unmount();

        renderCard('cheapest');
        expect(screen.getByText('Cheapest')).toBeInTheDocument();
    });

    it('carries no badge when it is neither', () => {
        renderCard();
        expect(screen.queryByText('Fastest')).not.toBeInTheDocument();
        expect(screen.queryByText('Cheapest')).not.toBeInTheDocument();
    });

    it('opens the flight details from under the price', () => {
        renderCard();
        const details = screen.getByRole('button', { name: 'Flight details' });
        expect(details).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(details);
        expect(details).toHaveAttribute('aria-expanded', 'true');
    });

    it('offers a short Select on a phone and Select Now on the desktop, from one button', () => {
        renderCard();
        const select = screen.getByText('Select').closest('button');
        expect(select).toBe(screen.getByText('Select Now').closest('button'));
    });
});
