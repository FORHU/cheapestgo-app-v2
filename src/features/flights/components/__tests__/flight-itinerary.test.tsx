import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import ko from '@/locales/ko.json';
import ja from '@/locales/ja.json';
import zh from '@/locales/zh.json';
import type { FlightOffer, NormalizedSegment } from '@/shared/types';
import { FlightItinerary } from '../flight-itinerary';
import { ROUND_TRIP } from './fixtures';

const renderIt = (offer: Pick<FlightOffer, 'segments' | 'sliceDurations'> = ROUND_TRIP) =>
    render(<NextIntlClientProvider locale="en" messages={en as never}><FlightItinerary offer={offer} /></NextIntlClientProvider>);

/** Manila → Seoul through Guangzhou, as the design draws it. */
const leg = (over: Partial<NormalizedSegment>): NormalizedSegment => ({
    segmentIndex: 0, airline: 'CZ', airlineName: 'China Southern', origin: 'MNL', destination: 'CAN',
    duration: 150, stops: 0, cabinClass: 'economy',
    departure: { airport: 'MNL', time: '' }, arrival: { airport: 'CAN', time: '' },
    ...over,
});
const CONNECTING = {
    segments: [
        leg({
            flightNumber: 'CZ5052', aircraft: 'Boeing 737 MAX 8',
            departure: { airport: 'MNL', city: 'Manila', airportName: 'Ninoy Aquino International Airport', time: '2026-11-25T03:20:00' },
            arrival:   { airport: 'CAN', city: 'Guangzhou', airportName: 'Baiyun International Airport', time: '2026-11-25T05:50:00' },
        }),
        leg({
            flightNumber: 'CZ0337', aircraft: 'Airbus A330-300', origin: 'CAN', destination: 'ICN', duration: 190,
            departure: { airport: 'CAN', city: 'Guangzhou', airportName: 'Baiyun International Airport', time: '2026-11-25T09:05:00' },
            arrival:   { airport: 'ICN', city: 'Seoul', airportName: 'Incheon International Airport', terminal: '1', time: '2026-11-25T13:15:00' },
        }),
    ],
    sliceDurations: [535],
};

describe('FlightItinerary — the timeline', () => {
    it('heads each direction with its route, day, stops and cabin, and its totals', () => {
        renderIt(CONNECTING);
        expect(screen.getByRole('heading', { name: 'Manila → Seoul' })).toBeInTheDocument();
        expect(screen.getByText('Wed, Nov 25, 2026 · 1 stop in Guangzhou · Economy')).toBeInTheDocument();
        expect(screen.getByText('Total trip')).toBeInTheDocument();
        expect(screen.getByText('8h 55m')).toBeInTheDocument();
        // The wait, in the heading's totals and on the layover note.
        expect(screen.getByText('3h 15m')).toBeInTheDocument();
    });

    it('gives each stop its clock, city and code, airport and terminal', () => {
        renderIt(CONNECTING);
        expect(screen.getByText('03:20')).toBeInTheDocument();
        expect(screen.getByText('13:15')).toBeInTheDocument();
        expect(screen.getByText('Manila (MNL)')).toBeInTheDocument();
        expect(screen.getAllByText('Guangzhou (CAN)')).toHaveLength(2);
        expect(screen.getByText('Ninoy Aquino International Airport · Terminal TBA')).toBeInTheDocument();
        expect(screen.getByText('Incheon International Airport · Terminal 1')).toBeInTheDocument();
    });

    it('puts each flight between its stops: airline and number, aircraft and cabin, time in the air', () => {
        renderIt(CONNECTING);
        expect(screen.getByText('China Southern · CZ5052')).toBeInTheDocument();
        expect(screen.getByText('Boeing 737 MAX 8 · Economy')).toBeInTheDocument();
        expect(screen.getByText('2h 30m')).toBeInTheDocument();
        expect(screen.getByText('3h 10m')).toBeInTheDocument();
    });

    it('says how long the wait between flights is, and where', () => {
        renderIt(CONNECTING);
        expect(screen.getByText(/3h 15m layover in Guangzhou/)).toBeInTheDocument();
        expect(screen.getByText(/same airport, no transfer/)).toBeInTheDocument();
    });

    it('warns when a connection means crossing to another airport', () => {
        const [first, second] = CONNECTING.segments;
        renderIt({
            ...CONNECTING,
            segments: [first, { ...second, origin: 'SZX', departure: { ...second.departure, airport: 'SZX', city: 'Shenzhen' } }],
        });
        expect(screen.getByText(/change airports, CAN to SZX/)).toBeInTheDocument();
    });

    it('notes that terminals come later only while one is still unknown', () => {
        renderIt(CONNECTING);
        expect(screen.getByText('Terminals are confirmed closer to departure. Times are local.')).toBeInTheDocument();
    });

    it('names each direction of a round trip, and marks a landing on the next day', () => {
        renderIt();
        expect(screen.getByText('Outbound')).toBeInTheDocument();
        expect(screen.getByText('Return')).toBeInTheDocument();
        // A nonstop direction's total is its one flight's time: in the heading, and on the flight.
        expect(screen.getAllByText('3h 55m')).toHaveLength(2);
        expect(screen.getAllByText('4h 5m')).toHaveLength(2);
        expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('leaves a single direction unnamed, and heads it by airport when no city is known', () => {
        renderIt({ ...ROUND_TRIP, segments: [ROUND_TRIP.segments[0]], sliceDurations: [235] });
        expect(screen.queryByText('Outbound')).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Clark International Airport → Incheon International Airport' })).toBeInTheDocument();
        expect(screen.getByText('Clark International Airport (CRK)')).toBeInTheDocument();
    });
});

describe('the timeline\'s words', () => {
    const KEYS = [
        'outbound', 'return', 'legLabel', 'layoverLabel', 'terminal', 'nonstop', 'stopCount', 'terminalTba', 'oneStopIn',
        'totalTrip', 'layoverIn', 'sameAirport', 'changeAirports', 'footnote', 'footnoteTerminals',
    ];
    it.each([['en', en], ['ko', ko], ['ja', ja], ['zh', zh]] as const)('are all there in %s', (_lang, messages) => {
        const itinerary = (messages as unknown as { flights: { itinerary: Record<string, unknown> } }).flights.itinerary;
        for (const key of KEYS) expect(itinerary[key], key).toBeTypeOf('string');
    });
});
