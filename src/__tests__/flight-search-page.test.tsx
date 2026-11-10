/**
 * The flight results page, when a fare the traveller picked has gone.
 *
 * Two ways in: the checkout sends them back here (`fareGone=1`, from `fareGoneSearchHref`), or
 * the check made on "Select" finds the offer already gone. Either way the offers on screen are
 * the airline's as of now — a new search — and the traveller is told why they are looking at
 * them again.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';

// ── the world around the page ────────────────────────────────────────────────

let query = '';
const push = vi.fn();
const replace = vi.fn();
const post = vi.fn();

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(query),
}));
vi.mock('@/i18n/navigation', () => ({
    Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
        <a href={href} {...rest}>{children}</a>
    ),
    useRouter: () => ({ push, replace, back: vi.fn() }),
}));
vi.mock('@/shared/lib/http', () => ({
    http: { post: (...a: unknown[]) => post(...a), get: vi.fn(async () => ({})) },
}));
vi.mock('@/shared/auth/store', () => ({ useAuthStore: () => ({ user: null, isLoading: false }) }));
vi.mock('@/shared/components/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
// Not what is under test, and each brings a world of its own: the route and trip editors, the
// currency and language menus, a price-alert subscription.
vi.mock('@/features/flights/components/flight-search-top-bar', () => ({ FlightSearchTopBar: () => null }));
vi.mock('@/features/flights/components/PriceAlertButton', () => ({ PriceAlertButton: () => null }));

import { FlightSearchClient } from '@/app/[locale]/flights/search/flight-search-client';

// The results list pages itself in as it scrolls into view; jsdom has no viewport to watch.
vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
});

// Every search waits out a short minimum before it shows, so the skeleton does not flash.
vi.setConfig({ testTimeout: 20_000 });
const SHOWN = { timeout: 5_000 };

// ── fixtures ─────────────────────────────────────────────────────────────────

const SEARCH = 'origin=MNL&destination=NRT&depart=2026-12-01&adults=1';

function offer(offerId: string, airlineName: string, total: number) {
    return {
        offerId, provider: 'duffel',
        price: { total, base: total, taxes: 0, currency: 'USD', pricePerAdult: total },
        segments: [{
            segmentIndex: 0, airline: 'ZZ', airlineName, flightNumber: 'ZZ2200',
            origin: 'MNL', destination: 'NRT',
            departure: { airport: 'MNL', time: '2026-12-01T13:56:00' },
            arrival:   { airport: 'NRT', time: '2026-12-01T19:35:00' },
            duration: 279, stops: 0, cabinClass: 'economy',
        }],
        totalDuration: 279, sliceDurations: [279], totalStops: 0,
        refundable: true, baggage: { checkedBags: 1, cabinBag: true },
        normalizedPriceUsd: total, bestScore: 0, physicalFlightId: offerId,
    };
}

/** What the airline sells, search by search: the first answer, then each one after. */
let searches: unknown[][] = [];
let revalidation: Record<string, unknown> = { success: true, priceChanged: false };

const searchCalls = () => post.mock.calls.filter((c) => c[0] === '/api/flights/search');

const renderPage = () =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><FlightSearchClient /></NextIntlClientProvider>);

beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    query = SEARCH;
    searches = [[offer('off_old', 'Yesterday Air', 250)], [offer('off_new', 'Today Air', 310)]];
    revalidation = { success: true, priceChanged: false };
    post.mockImplementation(async (path: string) => {
        if (path === '/api/flights/search') {
            const n = searchCalls().length - 1;
            return { offers: searches[Math.min(n, searches.length - 1)] };
        }
        if (path === '/api/flights/revalidate') return revalidation;
        throw new Error(`unexpected POST ${path}`);
    });
});

// ── the tests ────────────────────────────────────────────────────────────────

describe('sent back from a checkout whose fare had gone', () => {
    it('says why the traveller is back, over a new search of their route', async () => {
        query = `${SEARCH}&fareGone=1`;
        renderPage();

        expect(await screen.findByText('That fare is no longer available', undefined, SHOWN)).toBeInTheDocument();
        expect(screen.getByText(/you have not been charged/i)).toBeInTheDocument();
        expect(searchCalls()).toHaveLength(1);
        expect(searchCalls()[0][1]).toMatchObject({ origin: 'MNL', destination: 'NRT', departureDate: '2026-12-01' });
    });

    it('says nothing of the kind on an ordinary search', async () => {
        renderPage();

        await screen.findAllByText('Yesterday Air', undefined, SHOWN);
        expect(screen.queryByText('That fare is no longer available')).not.toBeInTheDocument();
    });
});

describe('a fare already gone when it is picked', () => {
    it('stays on the results, says so, and shows the airline\'s offers as of now', async () => {
        revalidation = { success: true, seatsAvailable: false, priceChanged: false, offerExpired: true };
        renderPage();
        await screen.findAllByText('Yesterday Air', undefined, SHOWN);

        fireEvent.click(screen.getAllByRole('button', { name: /select now/i })[0]);

        expect(await screen.findByText('That fare is no longer available', undefined, SHOWN)).toBeInTheDocument();
        expect((await screen.findAllByText('Today Air', undefined, SHOWN)).length).toBeGreaterThan(0);
        expect(screen.queryAllByText('Yesterday Air')).toHaveLength(0);
        expect(searchCalls()).toHaveLength(2);
        expect(push).not.toHaveBeenCalled();
    });
});

describe('a fare still on sale', () => {
    it('goes to checkout carrying the search it was picked from — without the note from last time', async () => {
        query = `${SEARCH}&fareGone=1`;
        renderPage();
        await screen.findAllByText('Yesterday Air', undefined, SHOWN);

        fireEvent.click(screen.getAllByRole('button', { name: /select now/i })[0]);

        await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
        const [path, qs] = String(push.mock.calls[0][0]).split('?');
        expect(path).toBe('/flights/book');
        expect(new URLSearchParams(qs).get('offerId')).toBe('off_old');
        expect(new URLSearchParams(qs).get('search')).toBe(SEARCH);
    });
});
