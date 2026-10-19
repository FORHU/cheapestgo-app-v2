import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { checkoutPalette } from '../../lib/palette';
import { FlightSummaryCard } from '../flight-summary-card';
import { ROUND_TRIP } from '@/features/flights/components/__tests__/fixtures';

const palette = checkoutPalette('dark');
const FALLBACK = { origin: 'CRK', destination: 'ICN', departureDate: '2026-10-29', cabin: 'economy' };

const renderCard = (offer: typeof ROUND_TRIP | null = ROUND_TRIP) =>
    render(
        <NextIntlClientProvider locale="en" messages={en as never}>
            <FlightSummaryCard offer={offer} fallback={FALLBACK} total={297} currency="USD" palette={palette} />
        </NextIntlClientProvider>,
    );

describe('FlightSummaryCard — the flight being bought, as v1 showed it', () => {
    it('names the airline and the flight', () => {
        renderCard();
        expect(screen.getByText('Jeju Air')).toBeInTheDocument();
        expect(screen.getByText('7C2108')).toBeInTheDocument();
    });

    it('lists what the fare includes: bags, terms, cabin', () => {
        renderCard();
        const facts = within(screen.getByRole('list', { name: 'Fare details' }));
        expect(facts.getByText('1 carry-on bag')).toBeInTheDocument();
        expect(facts.getByText('1 checked bag')).toBeInTheDocument();
        expect(facts.getByText('Non-refundable')).toBeInTheDocument();
        expect(facts.getByText('Economy')).toBeInTheDocument();
    });

    it('shows the total price', () => {
        renderCard();
        expect(screen.getByText('USD 297')).toBeInTheDocument();
        expect(screen.getByText('total price')).toBeInTheDocument();
    });

    it('shows the outbound end to end: when, from and to where, how long, how many stops', () => {
        renderCard();
        expect(screen.getByText('01:45')).toBeInTheDocument();
        expect(screen.getByText('Departing')).toBeInTheDocument();
        expect(screen.getByText('Clark International Airport (CRK)')).toBeInTheDocument();
        expect(screen.getByText('06:40')).toBeInTheDocument();
        expect(screen.getByText('Arriving at')).toBeInTheDocument();
        expect(screen.getByText('Incheon International Airport (ICN)')).toBeInTheDocument();
        expect(screen.getByText('Terminal 1')).toBeInTheDocument();
        expect(screen.getByText('3h 55m')).toBeInTheDocument();
        expect(screen.getByText('Nonstop')).toBeInTheDocument();
    });

    it('opens the flight-by-flight itinerary on request, and closes it again', () => {
        renderCard();
        expect(screen.queryByText('Outbound')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Show flight itineraries' }));
        expect(screen.getByText('Outbound')).toBeInTheDocument();
        expect(screen.getByText('Return')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Hide flight itineraries' }));
        expect(screen.queryByText('Outbound')).not.toBeInTheDocument();
    });

    it('says nothing about bags the fare does not mention', () => {
        renderCard({ ...ROUND_TRIP, baggage: undefined });
        expect(screen.queryByText(/carry-on|checked bag/)).not.toBeInTheDocument();
    });

    it('shows the route, date and price from the search while the offer is not in hand', () => {
        renderCard(null);
        expect(screen.getByText('CRK → ICN')).toBeInTheDocument();
        expect(screen.getByText('USD 297')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Show flight itineraries' })).not.toBeInTheDocument();
    });
});
