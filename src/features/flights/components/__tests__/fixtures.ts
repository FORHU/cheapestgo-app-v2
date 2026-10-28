import type { FlightOffer } from '@/shared/types';

/** Jeju Air, Clark ⇄ Incheon — the round trip v1's card is drawn with. */
export const ROUND_TRIP: FlightOffer = {
    offerId: 'off_1',
    provider: 'duffel',
    price: { total: 297, base: 240, taxes: 57, currency: 'USD', pricePerAdult: 297 },
    segments: [
        {
            segmentIndex: 0, airline: '7C', airlineName: 'Jeju Air', flightNumber: '7C2108',
            origin: 'CRK', destination: 'ICN', duration: 235, stops: 0, aircraft: 'Boeing 737-800', cabinClass: 'economy',
            departure: { airport: 'CRK', airportName: 'Clark International Airport', time: '2026-10-29T01:45:00' },
            arrival:   { airport: 'ICN', airportName: 'Incheon International Airport', terminal: '1', time: '2026-10-29T06:40:00' },
        },
        {
            segmentIndex: 1, airline: '7C', airlineName: 'Jeju Air', flightNumber: '7C2107',
            origin: 'ICN', destination: 'CRK', duration: 245, stops: 0, aircraft: 'Boeing 737-800', cabinClass: 'economy',
            departure: { airport: 'ICN', airportName: 'Incheon International Airport', terminal: '1', time: '2026-10-31T21:40:00' },
            arrival:   { airport: 'CRK', airportName: 'Clark International Airport', time: '2026-11-01T00:45:00' },
        },
    ],
    totalDuration: 480,
    sliceDurations: [235, 245],
    totalStops: 0,
    refundable: false,
    farePolicy: { isRefundable: false, isChangeable: false },
    baggage: { cabinBag: true, checkedBags: 1 },
    tripType: 'round-trip',
    normalizedPriceUsd: 297,
    bestScore: 0,
    physicalFlightId: 'off_1',
};
