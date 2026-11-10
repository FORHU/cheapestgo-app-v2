import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import { FlightItinerary } from '../flight-itinerary';
import { ROUND_TRIP } from './fixtures';

const renderIt = (offer = ROUND_TRIP) =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><FlightItinerary offer={offer} /></NextIntlClientProvider>);

describe('FlightItinerary — v1\'s flight-by-flight timeline', () => {
    it('names each direction with its own duration', () => {
        renderIt();
        expect(screen.getByText('Outbound')).toBeInTheDocument();
        expect(screen.getByText('Return')).toBeInTheDocument();
        expect(screen.getByText('3h 55m', { selector: 'span span' })).toBeInTheDocument();
        expect(screen.getByText('4h 5m', { selector: 'span span' })).toBeInTheDocument();
    });

    it('gives each end its airport, date and time, terminal, cabin and flight, and aircraft', () => {
        renderIt();
        expect(screen.getAllByText('Clark International Airport (CRK)')).toHaveLength(2);
        expect(screen.getByText(/Thu, Oct 29, 2026, 01:45/)).toBeInTheDocument();
        expect(screen.getAllByText('Terminal 1').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Terminal available closer to departure').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Economy 7C2108')).toHaveLength(2);
        expect(screen.getAllByText('Boeing 737-800')).toHaveLength(4);
    });

    it('marks a landing on the next day', () => {
        renderIt();
        expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('leaves a single direction unnamed', () => {
        renderIt({ ...ROUND_TRIP, segments: [ROUND_TRIP.segments[0]], sliceDurations: [235] });
        expect(screen.queryByText('Outbound')).not.toBeInTheDocument();
    });
});
