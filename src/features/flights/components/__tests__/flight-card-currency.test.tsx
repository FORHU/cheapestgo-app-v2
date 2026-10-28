import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { ROUND_TRIP } from './fixtures';

/**
 * The flight results page has a currency selector in its top bar, and nothing on the page
 * listened to it: each card printed the airline's currency whatever was picked. Hotels convert
 * for display; flights now do the same, from the same function, with the same rule — until the
 * rates are live the price is left in the currency it came in, and says so.
 */

const live = vi.hoisted(() => ({ on: false, currency: 'KRW' }));

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock('@/shared/auth/store', () => ({ useAuthStore: () => ({ user: null }) }));
vi.mock('@/shared/lib/http', () => ({ http: { get: vi.fn(async () => ({})), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@/shared/stores/search.store', () => ({ useUserCurrency: () => live.currency }));
vi.mock('@/shared/lib/currency', async (importOriginal) => {
    const real = await importOriginal<typeof import('@/shared/lib/currency')>();
    return {
        ...real,
        // 1 USD = 1,400 KRW, once the rates have landed.
        ratesAreLive: () => live.on,
        convertForDisplay: (amount: number, from: string, to: string) =>
            live.on && from !== to ? { amount: amount * 1400, currency: to } : { amount, currency: from },
    };
});

import { FlightCard } from '@/features/flights/components/flight-card';

const renderCard = () =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><FlightCard offer={ROUND_TRIP} /></NextIntlClientProvider>);

beforeEach(() => { live.on = false; live.currency = 'KRW'; });

describe('the flight card\'s prices', () => {
    it('shows the price in the currency picked, once the rates are live', () => {
        live.on = true;
        renderCard();
        // 297 USD × 1,400.
        expect(screen.getByText('₩415,800')).toBeInTheDocument();
        expect(screen.queryByText('$297')).not.toBeInTheDocument();
    });

    it('leaves the airline\'s price in its own currency until the rates are live — never a made-up figure', () => {
        renderCard();
        expect(screen.getByText('$297')).toBeInTheDocument();
        expect(screen.queryByText('₩415,800')).not.toBeInTheDocument();
    });

    it('prints the airline\'s own currency when that is the one picked', () => {
        live.on = true;
        live.currency = 'USD';
        renderCard();
        expect(screen.getByText('$297')).toBeInTheDocument();
    });
});
