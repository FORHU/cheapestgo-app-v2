/**
 * A saved flight or stay keeps the price it was saved at, in the currency the supplier quoted
 * it in — the same figure the results card showed converted. Listed on the account page it
 * printed the supplier's currency whatever the header said; it now follows the selector, by
 * the cards' rule: converted once the rates are live, its own currency until then.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

const live = vi.hoisted(() => ({ on: false, currency: 'KRW' }));

vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock('@/shared/lib/http', () => ({
    http: {
        get: vi.fn(async () => [{
            id: 's1', type: 'flight', title: 'CRK → LHR', price: 297, currency: 'USD',
            deep_link: '/flights/search', created_at: '2026-10-01T00:00:00.000Z',
        }]),
        delete: vi.fn(),
    },
}));
vi.mock('@/shared/stores/search.store', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/shared/stores/search.store')>()),
    useUserCurrency: () => live.currency,
}));
vi.mock('@/shared/lib/currency', async (importOriginal) => {
    const real = await importOriginal<typeof import('@/shared/lib/currency')>();
    return {
        ...real,
        ratesAreLive: () => live.on,
        convertForDisplay: (amount: number, from: string, to: string) =>
            live.on && from !== to ? { amount: amount * 1400, currency: to } : { amount, currency: from },
    };
});

import { SavedTripsSection } from '../saved-trips-section';

const renderSection = () =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><SavedTripsSection /></NextIntlClientProvider>);

beforeEach(() => { live.on = false; live.currency = 'KRW'; });

describe('saved trips under the currency selector', () => {
    it('shows a saved price in the currency picked, once the rates are live', async () => {
        live.on = true;
        renderSection();
        // 297 USD × 1,400.
        expect(await screen.findByText('₩415,800')).toBeInTheDocument();
        expect(screen.queryByText('$297')).not.toBeInTheDocument();
    });

    it('keeps the supplier\'s currency until the rates are live', async () => {
        renderSection();
        expect(await screen.findByText('$297')).toBeInTheDocument();
    });
});
